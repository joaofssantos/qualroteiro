// Spike F0 (D3): recolorir o estilo OpenFreeMap "liberty" por papel de token.
// Uso: agentop run --rm -- node apps/web/scripts/map-recolor-spike.mjs [outDir]
// Saída: capturas (3 locais x claro/escuro), roles.json, report.json (contraste, vazamento).
import { chromium } from '@playwright/test'
import { createRequire } from 'node:module'
import { mkdirSync, mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const STYLE_URL = 'https://tiles.openfreemap.org/styles/liberty'
const OUT = resolve(process.argv[2] ?? new URL('../../../docs/qa/2026-11-layout-f0-recolor-spike/screens', import.meta.url).pathname)
const CHROME =
  process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const require = createRequire(import.meta.url)
const maplibreDir = resolve(require.resolve('maplibre-gl/package.json'), '..', 'dist')

// Paleta escura candidata (valores que F1 deve declarar como --map-*; aqui só para o spike).
export const DARK = {
  land: '#1b2127',
  landAlt: '#20272e',
  park: '#1f2e27',
  water: '#0f2433',
  road: '#3a444d',
  roadCasing: '#161b20',
  roadMajor: '#56626c',
  roadMajorCasing: '#12161a',
  label: '#d7dde2',
  labelHalo: '#12171b',
  boundary: '#46525c',
  building: '#252d34',
}

/** Papel de token de uma camada, por regra (type / source-layer / prefixo do id). */
export function roleOf(layer) {
  const { id, type } = layer
  const sl = layer['source-layer'] ?? ''
  if (type === 'background') return 'land'
  if (type === 'raster') return 'land'
  if (type === 'symbol') {
    if (/one_way_arrow|shield/.test(id)) return 'ignored' // ícones do sprite sem texto relevante
    return 'label'
  }
  if (type === 'fill-extrusion') return 'land'
  if (sl === 'water' || sl === 'waterway') return 'water'
  if (sl === 'park' || /^landcover_(wood|grass|wetland)$/.test(id)) return 'park'
  if (sl === 'landuse' || sl === 'landcover' || sl === 'building' || id === 'aeroway_fill') return 'land'
  if (sl === 'aeroway') return 'road'
  if (sl === 'transportation') {
    if (/rail|hatching/.test(id)) return 'road'
    if (/motorway|trunk|primary|secondary_tertiary/.test(id) && !/link/.test(id)) return 'road-major'
    return 'road'
  }
  return 'ignored' // boundary_*, etc.
}

function paintFor(layer, role) {
  const id = layer.id
  const casing = /casing/.test(id)
  if (layer.type === 'background') return { 'background-color': DARK.land }
  if (layer.type === 'raster') return { 'raster-opacity': 0 }
  if (layer.type === 'fill-extrusion') return { 'fill-extrusion-color': DARK.building }
  if (layer.type === 'symbol') {
    if (role !== 'label') return null
    return { 'text-color': DARK.label, 'text-halo-color': DARK.labelHalo }
  }
  if (layer.type === 'fill') {
    const c = { water: DARK.water, park: DARK.park, land: id === 'building' ? DARK.building : DARK.landAlt }[role]
    return c ? { 'fill-color': c, ...( 'fill-outline-color' in (layer.paint ?? {}) ? { 'fill-outline-color': c } : {}) } : null
  }
  if (layer.type === 'line') {
    if (role === 'water') return { 'line-color': DARK.water }
    if (role === 'park') return { 'line-color': DARK.park }
    if (role === 'road') return { 'line-color': casing ? DARK.roadCasing : DARK.road }
    if (role === 'road-major') return { 'line-color': casing ? DARK.roadMajorCasing : DARK.roadMajor }
  }
  return null
}

export function recolorStyle(style) {
  const out = structuredClone(style)
  const roles = []
  for (const layer of out.layers) {
    const role = roleOf(layer)
    const paint = paintFor(layer, role)
    roles.push({ id: layer.id, type: layer.type, sourceLayer: layer['source-layer'] ?? '', role: paint ? role : 'ignored' })
    if (!paint) continue
    layer.paint = { ...(layer.paint ?? {}), ...paint }
  }
  return { style: out, roles }
}

// --- contraste (WCAG) -------------------------------------------------------
const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
function lum(hex) {
  const n = parseInt(hex.slice(1), 16)
  return 0.2126 * lin(((n >> 16) & 255) / 255) + 0.7152 * lin(((n >> 8) & 255) / 255) + 0.0722 * lin((n & 255) / 255)
}
export function contrast(a, b) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const VIEWS = [
  { key: 'sp', label: 'São Paulo (Sé)', center: [-46.6333, -23.5505], zoom: 11.5 },
  { key: 'rio', label: 'Centro do Rio', center: [-43.1829, -22.9068], zoom: 14 },
  { key: 'rodovia', label: 'Rodovia (Dutra, Taubaté)', center: [-45.5565, -23.0264], zoom: 11 },
]

async function render(page, style, view) {
  await page.evaluate(
    ({ style, view }) =>
      new Promise((res, rej) => {
        const map = new window.maplibregl.Map({
          container: 'map', style, center: view.center, zoom: view.zoom, fadeDuration: 0, attributionControl: false,
        })
        window.__map = map
        const t = setTimeout(() => rej(new Error('timeout idle')), 60000)
        map.once('idle', () => { clearTimeout(t); res() })
        map.on('error', (e) => { window.__errs = (window.__errs ?? []).concat(String(e.error?.message ?? e)) })
      }),
    { style, view },
  )
  await page.evaluate(() => { window.__map.remove(); })
}

// Mede, nos pixels, quanto do mapa escuro é "claro" (vazamento) e o brilho médio.
async function leakStats(page, pngBuf) {
  const b64 = pngBuf.toString('base64')
  return page.evaluate(async (b64) => {
    const img = new Image()
    img.src = `data:image/png;base64,${b64}`
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    const g = c.getContext('2d'); g.drawImage(img, 0, 0)
    const d = g.getImageData(0, 0, c.width, c.height).data
    let bright = 0, sum = 0, n = d.length / 4
    for (let i = 0; i < d.length; i += 4) {
      const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255
      sum += l
      if (l > 0.6) bright++
    }
    return { brightFraction: bright / n, meanLuma: sum / n }
  }, b64)
}

async function main() {
  mkdirSync(OUT, { recursive: true })
  const style = await (await fetch(STYLE_URL)).json()
  const { style: dark, roles } = recolorStyle(style)
  const profile = mkdtempSync(join(tmpdir(), 'f0-chrome-'))
  const ctx = await chromium.launchPersistentContext(profile, {
    executablePath: existsSync(CHROME) ? CHROME : undefined,
    headless: true,
    viewport: { width: 1280, height: 800 },
    args: ['--use-mock-keychain', '--password-store=basic', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })
  const page = ctx.pages()[0] ?? (await ctx.newPage())
  await page.setContent('<style>html,body,#map{margin:0;width:1280px;height:800px}</style><div id="map"></div>')
  await page.addStyleTag({ path: join(maplibreDir, 'maplibre-gl.css') })
  await page.addScriptTag({ path: join(maplibreDir, 'maplibre-gl.js') })

  const stats = {}
  for (const [mode, st] of [['claro', style], ['escuro', dark]]) {
    for (const v of VIEWS) {
      const container = page.locator('#map')
      await page.evaluate(({ style, view }) => { window.__pending = { style, view } }, { style: st, view: v })
      // renderiza e captura no mesmo mapa (sem remover antes da captura)
      await page.evaluate(
        ({ style, view }) =>
          new Promise((res, rej) => {
            const map = new window.maplibregl.Map({ container: 'map', style, center: view.center, zoom: view.zoom, fadeDuration: 0, attributionControl: false })
            window.__map = map
            const t = setTimeout(() => rej(new Error('timeout idle')), 90000)
            map.once('idle', () => { clearTimeout(t); res() })
          }),
        { style: st, view: v },
      )
      const buf = await container.screenshot({ path: join(OUT, `${v.key}-${mode}.png`) })
      stats[`${v.key}-${mode}`] = await leakStats(page, buf)
      await page.evaluate(() => window.__map.remove())
    }
  }
  await ctx.close()

  const label = contrast(DARK.label, DARK.labelHalo)
  const labelOnLand = Math.min(contrast(DARK.label, DARK.land), contrast(DARK.label, DARK.landAlt), contrast(DARK.label, DARK.water), contrast(DARK.label, DARK.park), contrast(DARK.label, DARK.road), contrast(DARK.label, DARK.roadMajor))
  const roleCount = roles.reduce((a, r) => ((a[r.role] = (a[r.role] ?? 0) + 1), a), {})
  const report = {
    generatedAt: new Date().toISOString(),
    styleUrl: STYLE_URL,
    layerCount: roles.length,
    roleCount,
    ignored: roles.filter((r) => r.role === 'ignored').map((r) => r.id),
    contrast: { labelVsHalo: +label.toFixed(2), labelVsWorstBackground: +labelOnLand.toFixed(2), threshold: 4.5 },
    leak: stats,
    palette: DARK,
  }
  writeFileSync(join(OUT, '..', 'roles.json'), JSON.stringify(roles, null, 2))
  writeFileSync(join(OUT, '..', 'report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report, null, 2))
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((e) => { console.error(e); process.exit(1) })
}
