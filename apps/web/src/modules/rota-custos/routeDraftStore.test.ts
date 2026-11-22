import { beforeEach, describe, expect, it } from 'vitest';

import { DEFAULT_VEHICLE, EMPTY_FIELD, useRouteDraftStore } from './routeDraftStore';

beforeEach(() => useRouteDraftStore.getState().reset());

describe('useRouteDraftStore', () => {
  it('starts empty with the default vehicle', () => {
    const s = useRouteDraftStore.getState();
    expect(s.origin).toEqual(EMPTY_FIELD);
    expect(s.destination).toEqual(EMPTY_FIELD);
    expect(s.stops).toEqual([]);
    expect(s.vehicle).toEqual(DEFAULT_VEHICLE);
  });

  it('keeps edits until reset', () => {
    const s = useRouteDraftStore.getState();
    s.setOrigin({ text: 'São Paulo', place: null });
    s.setStops([{ text: 'Campinas', place: null }]);

    expect(useRouteDraftStore.getState().origin.text).toBe('São Paulo');
    expect(useRouteDraftStore.getState().stops).toHaveLength(1);

    s.reset();
    expect(useRouteDraftStore.getState().origin).toEqual(EMPTY_FIELD);
    expect(useRouteDraftStore.getState().stops).toEqual([]);
  });
});
