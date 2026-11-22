import type { Page } from '@playwright/test';

export interface ContrastFinding {
  text: string;
  ratio: number;
  required: number;
  fg: string;
  bg: string;
  tag: string;
}

/** Contraste de texto (WCAG 1.4.3) de todo texto visível fora do mapa; fundo = 1º ancestral opaco. */
export function auditContrast(page: Page): Promise<{ checked: number; failures: ContrastFinding[] }> {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const parse = (css: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = '#000';
      ctx.fillStyle = css;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
    };
    const lum = (c: number[]) => {
      const f = (v: number) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      };
      return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
    };
    const over = (top: number[], below: number[]) => {
      const a = top[3]!;
      return [0, 1, 2].map((i) => top[i]! * a + below[i]! * (1 - a)).concat(1);
    };
    const backgroundOf = (el: Element): number[] | null => {
      const stack: number[][] = [];
      for (let node: Element | null = el; node; node = node.parentElement) {
        const cs = getComputedStyle(node);
        if (cs.backgroundImage !== 'none') return null; // gradiente/imagem: não dá para medir aqui
        const c = parse(cs.backgroundColor);
        if (c[3]! > 0) stack.push(c);
        if (c[3] === 1) break;
      }
      let acc: number[] = [255, 255, 255, 1];
      for (const layer of stack.reverse()) acc = over(layer, acc);
      return acc;
    };

    const failures: ContrastFinding[] = [];
    let checked = 0;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const seen = new Set<Element>();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || seen.has(el) || !n.textContent?.trim()) continue;
      seen.add(el);
      if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
      if (el.closest('.maplibregl-map, [aria-hidden="true"], [disabled], [aria-disabled="true"]')) continue;
      const cs = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const bg = backgroundOf(el);
      if (!bg) continue;
      const fg = over(parse(cs.color), bg);
      const [l1, l2] = [lum(fg), lum(bg)];
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      const size = parseFloat(cs.fontSize);
      const bold = Number(cs.fontWeight) >= 700;
      const large = size >= 24 || (bold && size >= 18.66);
      const required = large ? 3 : 4.5;
      checked += 1;
      if (ratio < required) {
        failures.push({
          text: n.textContent.trim().slice(0, 40),
          ratio: Math.round(ratio * 100) / 100,
          required,
          fg: cs.color,
          bg: `rgb(${bg.slice(0, 3).map(Math.round).join(',')})`,
          tag: el.tagName.toLowerCase(),
        });
      }
    }
    return { checked, failures };
  });
}

export interface TargetFinding {
  name: string;
  width: number;
  height: number;
  tag: string;
}

/** Alvos interativos menores que `min` px (WCAG 2.5.5/2.5.8 e meta do projeto: 44 px). */
export function auditTargets(page: Page, min = 44): Promise<{ checked: number; small: TargetFinding[] }> {
  return page.evaluate((minSize) => {
    const selector =
      'a[href], button, input:not([type=hidden]), select, textarea, [role=button], [role=radio], [role=tab], [role=switch], [role=combobox], summary';
    const small: TargetFinding[] = [];
    let checked = 0;
    for (const el of document.querySelectorAll<HTMLElement>(selector)) {
      if (el.matches(':disabled') || el.getAttribute('aria-disabled') === 'true') continue;
      if (el.closest('.maplibregl-ctrl-attrib')) continue; // atribuição obrigatória do OpenFreeMap/OSM
      const style = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || style.visibility === 'hidden') continue;
      // Radix esconde o <input>/<button> nativo de radio/switch atrás do controle visível.
      if (el.getAttribute('aria-hidden') === 'true' || el.hasAttribute('data-radix-focus-guard')) continue;
      checked += 1;
      // Pinos do mapa estendem a área de toque por um ::after invisível (index.css, mobile).
      if (el.classList.contains('map-pin')) {
        const after = getComputedStyle(el, '::after');
        if (parseFloat(after.width) >= minSize && parseFloat(after.height) >= minSize) continue;
      }
      if (rect.width < minSize - 0.5 || rect.height < minSize - 0.5) {
        small.push({
          name: (el.getAttribute('aria-label') || el.textContent || el.getAttribute('title') || el.tagName)
            .trim()
            .slice(0, 40),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          tag: el.tagName.toLowerCase(),
        });
      }
    }
    return { checked, small };
  }, min);
}

/** Navega por Tab e confere que cada elemento focado mostra anel (outline ou box-shadow). */
export async function auditFocus(
  page: Page,
  steps = 45,
): Promise<{ visited: number; invisible: string[] }> {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  const invisible: string[] = [];
  const names = new Set<string>();
  for (let i = 0; i < steps; i += 1) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return null;
      const cs = getComputedStyle(el);
      const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
      const shadow = cs.boxShadow !== 'none';
      const name = (el.getAttribute('aria-label') || el.textContent || el.tagName).trim().slice(0, 40);
      const focusVisible = el.matches(':focus-visible');
      return { name: `${el.tagName.toLowerCase()} "${name}"`, ring: outline || shadow, focusVisible };
    });
    if (!info) continue;
    if (names.has(info.name)) continue;
    names.add(info.name);
    if (!info.ring || !info.focusVisible) invisible.push(info.name);
  }
  return { visited: names.size, invisible };
}
