import { isWithinBuffer } from '@qualroteiro/geo';
import { describe, expect, it } from 'vitest';

import {
  AXLE_CATEGORIES,
  TOLL_MATCH_BUFFER_METERS,
  corridorPolyline,
  getCorridor,
  listCorridors,
} from '../src/index.js';

describe('seed dataset', () => {
  it('ships the three corridors named in the orientation spec', () => {
    expect(listCorridors().map((c) => c.id).sort()).toEqual([
      'sp-campinas-bandeirantes',
      'sp-curitiba-regis-bittencourt',
      'sp-rj-dutra',
    ]);
  });

  it('names the right highway for each corridor', () => {
    expect(getCorridor('sp-rj-dutra').highway).toBe('BR-116');
    expect(getCorridor('sp-curitiba-regis-bittencourt').highway).toBe('BR-116');
    expect(getCorridor('sp-campinas-bandeirantes').highway).toBe('SP-348');
  });

  it('throws a helpful error for an unknown corridor id', () => {
    // @ts-expect-error — exercising the runtime guard with an invalid id
    expect(() => getCorridor('sp-belem-transamazonica')).toThrow(/unknown corridor/i);
  });

  describe.each(listCorridors())('corridor $id', (corridor) => {
    it('has at least two plazas', () => {
      expect(corridor.plazas.length).toBeGreaterThanOrEqual(2);
    });

    it('gives every plaza a positive tariff in every axle category', () => {
      for (const plaza of corridor.plazas) {
        for (const category of AXLE_CATEGORIES) {
          const tariff = plaza.tariffByAxleCategory[category];
          expect(tariff, `${plaza.id} / ${category}`).toBeGreaterThan(0);
          expect(Number.isFinite(tariff)).toBe(true);
        }
      }
    });

    it('prices a motorcycle below a car, and a car below a 6-axle truck', () => {
      for (const plaza of corridor.plazas) {
        const t = plaza.tariffByAxleCategory;
        expect(t.motorcycle).toBeLessThan(t.car);
        expect(t.car).toBeLessThan(t.truck_6_axle);
      }
    });

    it('gives every plaza plausible Brazilian coordinates and a concessionaire', () => {
      for (const plaza of corridor.plazas) {
        expect(plaza.lat).toBeGreaterThan(-34);
        expect(plaza.lat).toBeLessThan(6);
        expect(plaza.lng).toBeGreaterThan(-74);
        expect(plaza.lng).toBeLessThan(-34);
        expect(plaza.concessionaire.length).toBeGreaterThan(0);
        expect(plaza.name.length).toBeGreaterThan(0);
      }
    });

    it('orders plazas by increasing km along the corridor', () => {
      const kms = corridor.plazas.map((p) => p.km);
      expect(kms).toEqual([...kms].sort((a, b) => a - b));
    });

    it('uses unique plaza ids', () => {
      const ids = corridor.plazas.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('is self-consistent: every plaza lies within the buffer of its own reference polyline', () => {
      const polyline = corridorPolyline(corridor.id);
      for (const plaza of corridor.plazas) {
        expect(
          isWithinBuffer({ lng: plaza.lng, lat: plaza.lat }, polyline, TOLL_MATCH_BUFFER_METERS),
          `${plaza.id} is off its own corridor polyline`,
        ).toBe(true);
      }
    });

    it('exposes a road-following reference polyline with at least 50 vertices', () => {
      const polyline = corridorPolyline(corridor.id);
      expect(polyline.type).toBe('LineString');
      expect(polyline.coordinates.length).toBeGreaterThanOrEqual(50);
    });
  });

  it('keeps plaza ids unique across the whole seed', () => {
    const ids = listCorridors().flatMap((c) => c.plazas.map((p) => p.id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});
