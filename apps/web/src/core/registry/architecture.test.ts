/**
 * The dependency rule, enforced.
 *
 *     src/modules/**  ──imports──▶  src/core/**
 *     src/core/**     ──never────▶  src/modules/**
 *
 * This is asserted by reading the source rather than by an ESLint rule, because a
 * lint rule can be silenced with a one-line `// eslint-disable-next-line` in the
 * very commit that breaks the architecture, and nobody reviewing a 40-file diff
 * would notice. A failing test cannot be silenced without deleting the test, which
 * is a conspicuous thing to find in a diff.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Resolved from the Vitest root (`apps/web`) rather than from `import.meta.url`:
 * under the jsdom environment `import.meta.url` is an `http://` URL, so
 * `fileURLToPath` throws.
 */
const SRC = join(process.cwd(), 'src');
const CORE = join(SRC, 'core');

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

/** Any import specifier that reaches into `src/modules`, however it is spelled. */
const FORBIDDEN = /from\s+['"](?:[./]*modules\/|@\/modules\/|\.\.\/modules)/;

/** `src`-relative, POSIX-style, so assertions read the same on every platform. */
function id(file: string): string {
  return relative(SRC, file).split(sep).join('/');
}

/**
 * Strip comments before checking for hard-coded module identity.
 *
 * A doc comment is allowed to *mention* a module as an example — that is
 * documentation, not a dependency. What must not exist is a module's name in the
 * shell's actual code.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

describe('core → modules dependency direction', () => {
  it('has core files to check (guards against the test silently passing on nothing)', () => {
    expect(existsSync(CORE)).toBe(true);
    expect(sourceFiles(CORE).length).toBeGreaterThan(5);
  });

  it('no file under src/core imports from src/modules', () => {
    const violations = sourceFiles(CORE)
      .filter((file) => FORBIDDEN.test(stripComments(readFileSync(file, 'utf8'))))
      .map(id);

    expect(violations).toEqual([]);
  });

  it('the shell hard-codes no module identity', () => {
    // The nav and the routes must be *derived* from the registry. If someone
    // "just added a link" to the sidebar, the module's id or path would appear
    // in the shell source, and this fails.
    const shellSources = sourceFiles(join(CORE, 'shell'))
      .map((file) => stripComments(readFileSync(file, 'utf8')))
      .join('\n');

    for (const moduleIdentifier of ['rota-custos', 'rotaCustos', 'Rota & Custos']) {
      expect(shellSources).not.toContain(moduleIdentifier);
    }
  });

  it('registers production modules from exactly one file', () => {
    // "Add a module = one file + one array entry" only holds while a single file
    // names concrete modules. `src/modules/index.ts` is that file.
    const registrars = sourceFiles(SRC)
      // The core declares `registerModule`; it is callers we are counting.
      .filter((file) => !file.startsWith(CORE))
      .filter((file) => /\bregisterModule\s*\(/.test(stripComments(readFileSync(file, 'utf8'))));

    expect(registrars.map(id)).toEqual(['modules/index.ts']);
  });
});
