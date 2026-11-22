import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Mede (F3) o que a F0 deixou em aberto: contraste de rota e pinos SOBRE o mapa,
 * nos dois temas, e dos rótulos sobre os fundos. Os valores vêm de `index.css`.
 * Gráficos: ≥ 3:1 (WCAG 1.4.11); texto: ≥ 4,5:1.
 */
const css = readFileSync(join(__dirname, '..', 'index.css'), 'utf8');

function vars(selector: RegExp): Record<string, [number, number, number]> {
  const m = selector.exec(css);
  if (!m) throw new Error(`bloco ${selector} ausente`);
  let depth = 0;
  let i = css.indexOf('{', m.index);
  const start = i;
  for (; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) break;
  }
  const out: Record<string, [number, number, number]> = {};
  for (const x of css.slice(start, i).matchAll(/(--[\w-]+)\s*:\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*;/g)) {
    out[x[1]!] = [Number(x[2]), Number(x[3]), Number(x[4])];
  }
  return out;
}

function luminance([h, s, l]: [number, number, number]): number {
  const S = s / 100;
  const L = l / 100;
  const a = S * Math.min(L, 1 - L);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(f(0)) + 0.7152 * lin(f(8)) + 0.0722 * lin(f(4));
}

function contrast(a: [number, number, number], b: [number, number, number]): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
}

const THEMES = {
  claro: vars(/^\s*:root\s*\{/m),
  escuro: vars(/^\s*\.dark\s*\{/m),
};
const at = (t: Record<string, [number, number, number]>, k: string) => {
  const v = t[k];
  if (!v) throw new Error(`token ${k} ausente`);
  return v;
};

describe.each(Object.entries(THEMES))('contraste sobre o mapa (%s)', (_name, t) => {
  const grounds = ['--map-land', '--map-water', '--map-park', '--map-road', '--map-road-major'];

  it('a rota se destaca de todos os fundos (traçado + contorno, ≥ 3:1)', () => {
    for (const g of grounds) {
      const best = Math.max(contrast(at(t, '--route'), at(t, g)), contrast(at(t, '--route-casing'), at(t, g)));
      expect(best, `rota vs ${g}`).toBeGreaterThanOrEqual(3);
    }
    expect(contrast(at(t, '--route'), at(t, '--route-casing')), 'rota vs contorno').toBeGreaterThanOrEqual(3);
  });

  it('cada pino contrasta com o anel e com o terreno (≥ 3:1)', () => {
    for (const pin of ['--pin-origin', '--pin-dest', '--pin-toll', '--pin-fuel', '--pin-stop']) {
      expect(contrast(at(t, pin), at(t, '--pin-ring')), `${pin} vs anel`).toBeGreaterThanOrEqual(3);
      const vsLand = Math.max(contrast(at(t, pin), at(t, '--map-land')), contrast(at(t, '--pin-ring'), at(t, '--map-land')));
      expect(vsLand, `${pin} vs terreno`).toBeGreaterThanOrEqual(3);
    }
  });

  it('o rótulo é legível sobre o halo e sobre os fundos (≥ 4,5:1)', () => {
    expect(contrast(at(t, '--map-label'), at(t, '--map-label-halo'))).toBeGreaterThanOrEqual(4.5);
    for (const g of grounds) {
      expect(contrast(at(t, '--map-label'), at(t, g)), `rótulo vs ${g}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
