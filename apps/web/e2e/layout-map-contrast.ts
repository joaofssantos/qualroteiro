import type { Page } from '@playwright/test';

export interface MapContrastReport {
  route: {
    routeVsCasing: number;
    casingRendered: string;
    casingVsBasemapMin: number;
    /** Pior caso, entre as cores do mapa-base, do melhor contraste da borda externa (contorno ou traço). */
    outerEdgeMin: number;
    routeVsBasemapMin: number;
    basemapColors: { rgb: string; share: number; casing: number; route: number; routeVsCasing: number }[];
    routePixels: number;
  };
  pins: {
    label: string;
    textVsFill: number;
    fillVsBorder: number;
    borderVsBasemap: number;
    fillVsBasemap: number;
  }[];
}

/**
 * Mede o contraste REAL, sobre o mapa renderizado (pixels da captura), de:
 * - traçado (cor `--route`) contra o contorno (`--route-casing`) e do contorno contra o
 *   mapa-base ao redor (alvo: gráficos ≥ 3:1, WCAG 1.4.11);
 * - cada pino: texto do número contra o preenchimento (≥ 4,5:1), borda contra o mapa-base
 *   e preenchimento contra a borda (≥ 3:1).
 */
export async function measureMapContrast(page: Page): Promise<MapContrastReport> {
  const map = page.getByRole('region', { name: 'Mapa da rota' });
  // Só o mapa (basemap + traço + pinos): esconde painéis/cabeçalho que cobrem o mapa e os controles do MapLibre.
  const hide = await page.addStyleTag({
    content:
      'body *{visibility:hidden !important} .maplibregl-map, .maplibregl-map *{visibility:visible !important} .maplibregl-control-container, .maplibregl-control-container *{visibility:hidden !important}',
  });
  const shot = await map.screenshot({ animations: 'disabled' });
  const box = (await map.boundingBox())!;
  await hide.evaluate((el) => el.remove());
  return page.evaluate(
    async ({ b64, origin }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const scale = img.naturalWidth / origin.w;
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const { data, width, height } = ctx.getImageData(0, 0, cv.width, cv.height);

      const probe = document.createElement('canvas');
      probe.width = probe.height = 1;
      const pctx = probe.getContext('2d', { willReadFrequently: true })!;
      const parse = (css: string): [number, number, number] => {
        pctx.clearRect(0, 0, 1, 1);
        pctx.fillStyle = css;
        pctx.fillRect(0, 0, 1, 1);
        const d = pctx.getImageData(0, 0, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!];
      };
      const token = (name: string) =>
        parse(`hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`);
      const lum = (c: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
      };
      const ratio = (a: number[], c: number[]) => {
        const [x, y] = [lum(a), lum(c)];
        return Math.round(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)) * 100) / 100;
      };
      const px = (x: number, y: number): [number, number, number] | null => {
        if (x < 0 || y < 0 || x >= width || y >= height) return null;
        const i = (y * width + x) * 4;
        return [data[i]!, data[i + 1]!, data[i + 2]!];
      };
      const near = (a: number[], c: number[], tol = 10) =>
        Math.abs(a[0]! - c[0]!) <= tol && Math.abs(a[1]! - c[1]!) <= tol && Math.abs(a[2]! - c[2]!) <= tol;

      const route = token('--route');
      const casing = token('--route-casing');

      // Regiões dos pinos (em px da captura) — excluídas da amostragem do mapa-base.
      const pinEls = [...document.querySelectorAll<HTMLElement>('.maplibregl-marker')];
      const pinRects = pinEls.map((el) => {
        const r = el.getBoundingClientRect();
        return {
          el,
          x: (r.left - origin.x) * scale,
          y: (r.top - origin.y) * scale,
          w: r.width * scale,
          h: r.height * scale,
        };
      });
      const inPin = (x: number, y: number, pad: number) =>
        pinRects.some((p) => x >= p.x - pad && x <= p.x + p.w + pad && y >= p.y - pad && y <= p.y + p.h + pad);

      // 1) onde está o traço (grade de 4 px, dilatada 3 células): a vizinhança é excluída do mapa-base.
      const cell = 4;
      const gw = Math.ceil(width / cell);
      const gh = Math.ceil(height / cell);
      const grid = new Uint8Array(gw * gh);
      let routePixels = 0;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          if (near(px(x, y)!, route, 8) && !inPin(x, y, 8)) {
            routePixels += 1;
            grid[Math.floor(y / cell) * gw + Math.floor(x / cell)] = 1;
          }
        }
      }
      const zone = new Uint8Array(gw * gh);
      for (let gy = 0; gy < gh; gy += 1) {
        for (let gx = 0; gx < gw; gx += 1) {
          if (!grid[gy * gw + gx]) continue;
          for (let oy = -3; oy <= 3; oy += 1)
            for (let ox = -3; ox <= 3; ox += 1) {
              const yy = gy + oy;
              const xx = gx + ox;
              if (yy >= 0 && yy < gh && xx >= 0 && xx < gw) zone[yy * gw + xx] = 1;
            }
        }
      }
      // 2) cores dominantes do mapa-base (fora da vizinhança do traço e dos pinos).
      const hist = new Map<string, { rgb: [number, number, number]; n: number }>();
      let sampled = 0;
      for (let y = 0; y < height; y += 2) {
        for (let x = 0; x < width; x += 2) {
          if (zone[Math.floor(y / cell) * gw + Math.floor(x / cell)] || inPin(x, y, 10)) continue;
          const c = px(x, y)!;
          const key = c.map((v) => v >> 3).join(',');
          const cur = hist.get(key);
          if (cur) cur.n += 1;
          else hist.set(key, { rgb: c, n: 1 });
          sampled += 1;
        }
      }
      // 3) o contorno é desenhado com opacidade 0,9: a cor efetiva depende do fundo.
      const CASING_OPACITY = 0.9;
      const effCasing = (base: number[]) =>
        [0, 1, 2].map((i) => Math.round(casing[i]! * CASING_OPACITY + base[i]! * (1 - CASING_OPACITY)));
      const basemapColors = [...hist.values()]
        .sort((a, c) => c.n - a.n)
        .filter((h) => h.n / Math.max(sampled, 1) >= 0.04)
        .slice(0, 6)
        .map((h) => ({
          rgb: `rgb(${h.rgb.join(',')})`,
          share: Math.round((h.n / sampled) * 100) / 100,
          casing: ratio(effCasing(h.rgb), h.rgb),
          route: ratio(route, h.rgb),
          routeVsCasing: ratio(route, effCasing(h.rgb)),
        }));

      const pins = pinRects.map((p) => {
        const button = p.el.querySelector('button') ?? p.el;
        const cs = getComputedStyle(button);
        const fill = parse(cs.backgroundColor);
        const border = parse(cs.borderTopColor);
        const text = parse(cs.color);
        // amostra o mapa-base em um anel a 4 px do pino
        const ring: [number, number, number][] = [];
        const cx = p.x + p.w / 2;
        const cy = p.y + p.h / 2;
        const rad = Math.max(p.w, p.h) / 2 + 4 * scale;
        for (let k = 0; k < 24; k += 1) {
          const ang = (k / 24) * Math.PI * 2;
          const x = Math.round(cx + Math.cos(ang) * rad);
          const y = Math.round(cy + Math.sin(ang) * rad);
          const c = px(x, y);
          if (c && !inPin(x, y, -2) && !near(c, route, 14) && !near(c, casing, 14)) ring.push(c);
        }
        const median = (i: number) => [...ring].map((c) => c[i]!).sort((a, c) => a - c)[Math.floor(ring.length / 2)] ?? 0;
        const base: [number, number, number] = [median(0), median(1), median(2)];
        return {
          label: button.getAttribute('aria-label') ?? '',
          textVsFill: button.textContent?.trim() ? ratio(text, fill) : -1,
          fillVsBorder: ratio(fill, border),
          borderVsBasemap: ring.length ? ratio(border, base) : -1,
          fillVsBasemap: ring.length ? ratio(fill, base) : -1,
        };
      });

      return {
        route: {
          routeVsCasing: basemapColors.length ? Math.min(...basemapColors.map((c) => c.routeVsCasing)) : -1,
          casingRendered: `rgb(${casing.join(',')})`,
          casingVsBasemapMin: basemapColors.length ? Math.min(...basemapColors.map((c) => c.casing)) : -1,
          routeVsBasemapMin: basemapColors.length ? Math.min(...basemapColors.map((c) => c.route)) : -1,
          outerEdgeMin: basemapColors.length ? Math.min(...basemapColors.map((c) => Math.max(c.casing, c.route))) : -1,
          basemapColors,
          routePixels,
        },
        pins,
      };
    },
    { b64: shot.toString('base64'), origin: { x: box.x, y: box.y, w: box.width } },
  );
}

/** Quantos pixels da captura do mapa têm (≈) a cor do token — prova que algo foi desenhado. */
export async function countTokenPixels(page: Page, tokenName: string): Promise<number> {
  const shot = await page.getByRole('region', { name: 'Mapa da rota' }).screenshot({ animations: 'disabled' });
  return page.evaluate(
    async ({ b64, name }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const cv = document.createElement('canvas');
      cv.width = img.naturalWidth;
      cv.height = img.naturalHeight;
      const ctx = cv.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true })!;
      probe.fillStyle = `hsl(${getComputedStyle(document.documentElement).getPropertyValue(name).trim()})`;
      probe.fillRect(0, 0, 1, 1);
      const t = probe.getImageData(0, 0, 1, 1).data;
      const { data } = ctx.getImageData(0, 0, cv.width, cv.height);
      let n = 0;
      for (let i = 0; i < data.length; i += 4) {
        if (Math.abs(data[i]! - t[0]!) <= 3 && Math.abs(data[i + 1]! - t[1]!) <= 3 && Math.abs(data[i + 2]! - t[2]!) <= 3) n += 1;
      }
      return n;
    },
    { b64: shot.toString('base64'), name: tokenName },
  );
}
