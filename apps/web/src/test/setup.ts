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
