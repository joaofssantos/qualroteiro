import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readMapTheme, toMapLibreColor, watchTheme } from './theme';

function setVars(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) document.documentElement.style.setProperty(k, v);
}

describe('theme do mapa', () => {
  beforeEach(() => {
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
  });
  afterEach(() => vi.restoreAllMocks());

  it('resolve as vars de :root em cores', () => {
    setVars({
      '--route': '38 92% 50%',
      '--route-casing': '209 60% 16%',
      '--route-alt': '209 18% 55%',
      '--pin-toll': '350 66% 44%',
      '--pin-ring': '0 0% 100%',
      '--map-water': '205 55% 84%',
    });
    const t = readMapTheme();

    expect(t.route).toBe('hsl(38 92% 50%)');
    expect(t.casing).toBe('hsl(209 60% 16%)');
    expect(t.routeAlt).toBe('hsl(209 18% 55%)');
    expect(t.pins['toll']).toEqual({ bg: 'hsl(350 66% 44%)', ring: 'hsl(0 0% 100%)' });
    expect(t.base.water).toBe('hsl(205 55% 84%)');
  });

  it('toMapLibreColor converte para a sintaxe com vírgulas que o MapLibre lê', () => {
    expect(toMapLibreColor('hsl(38 92% 50%)')).toBe('hsl(38, 92%, 50%)');
  });

  it('watchTheme avisa ao alternar a classe dark e para após o unsubscribe', async () => {
    const cb = vi.fn();
    const stop = watchTheme(cb);

    document.documentElement.classList.add('dark');
    await vi.waitFor(() => expect(cb).toHaveBeenCalledTimes(1), { timeout: 3000 });

    stop();
    document.documentElement.classList.remove('dark');
    await new Promise((r) => setTimeout(r, 20));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});
