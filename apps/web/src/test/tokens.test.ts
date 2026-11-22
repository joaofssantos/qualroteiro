import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

const rel = (f: string) => relative(SRC, f);
const isTest = (f: string) => /\.test\.tsx?$/.test(f);

describe('tokens semânticos', () => {
  it('sem cor literal no mapa', () => {
    const re = /#[0-9a-fA-F]{3,8}\b|hsl\((?!var\()|rgba?\(/;
    const hits = walk(join(SRC, 'core/map'))
      .filter((f) => /\.tsx?$/.test(f) && !isTest(f) && !f.endsWith('theme.ts'))
      .filter((f) => re.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(hits).toEqual([]);
  });

  it('sem classes de paleta fixas', () => {
    const re = /\b(amber|emerald|red|green|blue)-\d{2,3}\b|\bbg-white\b/;
    const hits = walk(SRC)
      .filter((f) => f.endsWith('.tsx') && !isTest(f))
      .filter((f) => re.test(readFileSync(f, 'utf8')))
      .map(rel);
    expect(hits).toEqual([]);
  });

  it('toda var usada existe em :root e .dark', () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    const block = (sel: RegExp) => {
      const m = sel.exec(css);
      if (!m) throw new Error(`bloco ${sel} ausente`);
      let depth = 0;
      let i = css.indexOf('{', m.index);
      const start = i;
      for (; i < css.length; i++) {
        if (css[i] === '{') depth++;
        if (css[i] === '}' && --depth === 0) break;
      }
      return css.slice(start, i);
    };
    const defs = (b: string) => new Set([...b.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
    const light = defs(block(/^\s*:root\s*\{/m));
    const dark = defs(block(/^\s*\.dark\s*\{/m));

    const tailwind = readFileSync(join(SRC, '../tailwind.config.js'), 'utf8');
    const sources = [css, tailwind, readFileSync(join(SRC, 'core/map/layers.ts'), 'utf8')];
    const used = new Set(sources.flatMap((s) => [...s.matchAll(/var\((--[\w-]+)\)/g)].map((m) => m[1])));

    const missing = [...used].filter((v) => !light.has(v) || !dark.has(v));
    // --radius é geométrico e não muda no escuro
    expect(missing.filter((v) => v !== '--radius')).toEqual([]);
    for (const v of ['--surface', '--success-soft', '--cost-toll', '--route', '--pin-ring']) {
      expect(light.has(v) && dark.has(v), v).toBe(true);
    }
  });
});
