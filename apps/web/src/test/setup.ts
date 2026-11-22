import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

import { maplibreStub, resetMapStubs } from './maplibre-stub';

/**
 * MapLibre is replaced globally: it requires a WebGL context that jsdom does not
 * provide, so importing the real module would throw before any component under
 * test rendered. See `maplibre-stub.ts` for what the substitute preserves.
 */
vi.mock('maplibre-gl', () => maplibreStub);

/**
 * Os shells de layout são `lazy`. Aqui os carregadores viram "thenables"
 * síncronos sobre módulos importados estaticamente, para que os testes que
 * renderizam o app inteiro continuem síncronos. `AppShell.layout.test.tsx`
 * faz `vi.unmock` disto para exercitar o carregamento assíncrono real.
 */
vi.mock('@/core/layout/shellLoaders', async () => {
  const [a, b] = await Promise.all([
    import('@/core/shell/layouts/a'),
    import('@/core/shell/layouts/b'),
  ]);
  const sync = <T,>(module: T) => () => ({
    then(resolve: (value: T) => void) {
      resolve(module);
    },
  });
  return { shellLoaders: { a: sync(a), b: sync(b) } };
});

// jsdom implements neither, and MapLibre-adjacent code and Radix both use them.
beforeEach(() => {
  if (!('ResizeObserver' in globalThis)) {
    globalThis.ResizeObserver = class {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    } as unknown as typeof ResizeObserver;
  }
  // jsdom does not implement scrollIntoView; Radix calls it when moving focus.
  const elementPrototype = Element.prototype as unknown as Record<string, unknown>;
  if (typeof elementPrototype['scrollIntoView'] !== 'function') {
    elementPrototype['scrollIntoView'] = (): void => {};
  }
});

afterEach(() => {
  cleanup();
  resetMapStubs();
});
