import { beforeEach, describe, expect, it } from 'vitest';

import { useMapStore } from './mapStore';

const TRACE = { coordinates: [[-46.6, -23.5], [-43.1, -22.9]] as const };

describe('mapStore (F3)', () => {
  beforeEach(() => useMapStore.getState().clearMap());

  it('publica a prévia, o padding e o pedido de fit', () => {
    const s = useMapStore.getState();
    s.setMapPreview(TRACE);
    s.setMapPadding({ top: 8, right: 16, bottom: 24, left: 416 });
    const before = useMapStore.getState().fitRequest;
    s.requestFit();

    const next = useMapStore.getState();
    expect(next.preview).toEqual(TRACE);
    expect(next.padding).toEqual({ top: 8, right: 16, bottom: 24, left: 416 });
    expect(next.fitRequest).toBe(before + 1);
  });

  it('clearMap zera prévia e padding, mas nunca recua o contador de fit', () => {
    const s = useMapStore.getState();
    s.setMapPreview(TRACE);
    s.setMapPadding({ top: 1, right: 2, bottom: 3, left: 4 });
    s.requestFit();
    const count = useMapStore.getState().fitRequest;
    s.clearMap();

    const next = useMapStore.getState();
    expect(next.preview).toBeNull();
    expect(next.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(next.fitRequest).toBeGreaterThanOrEqual(count);
  });
});
