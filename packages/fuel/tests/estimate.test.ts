import { describe, expect, it } from 'vitest';

import { estimateFuel } from '../src/index.js';

describe('estimateFuel', () => {
  it('matches the acceptance vector: 430 km at 10 km/L and R$6/L', () => {
    const result = estimateFuel({ distanceKm: 430, consumptionKmPerL: 10, pricePerL: 6 });

    // Tolerance 1e-6 — the arithmetic is exact in IEEE-754 for these inputs,
    // so the tolerance only absorbs the documented rounding (3 dp / 2 dp).
    expect(result.liters).toBeCloseTo(43, 6);
    expect(result.cost).toBeCloseTo(258, 6);
  });

  it('is linear in distance', () => {
    const single = estimateFuel({ distanceKm: 100, consumptionKmPerL: 12.5, pricePerL: 5.99 });
    const double = estimateFuel({ distanceKm: 200, consumptionKmPerL: 12.5, pricePerL: 5.99 });

    expect(double.liters).toBeCloseTo(single.liters * 2, 6);
    expect(double.cost).toBeCloseTo(single.cost * 2, 6);
  });

  it('returns zero for a zero-distance trip', () => {
    expect(estimateFuel({ distanceKm: 0, consumptionKmPerL: 10, pricePerL: 6 })).toEqual({
      liters: 0,
      cost: 0,
    });
  });

  it('rounds cost to two decimals (BRL cents)', () => {
    // 100 / 3 = 33.333… L; at R$5.789/L that is R$192.966…
    const result = estimateFuel({ distanceKm: 100, consumptionKmPerL: 3, pricePerL: 5.789 });
    expect(result.liters).toBe(33.333);
    expect(result.cost).toBe(192.97);
  });

  describe('input guards', () => {
    it('rejects zero consumption rather than returning Infinity', () => {
      expect(() => estimateFuel({ distanceKm: 430, consumptionKmPerL: 0, pricePerL: 6 }))
        .toThrow(RangeError);
    });

    it('rejects negative consumption', () => {
      expect(() => estimateFuel({ distanceKm: 430, consumptionKmPerL: -10, pricePerL: 6 }))
        .toThrow(RangeError);
    });

    it('rejects non-finite consumption', () => {
      expect(() =>
        estimateFuel({ distanceKm: 430, consumptionKmPerL: Number.NaN, pricePerL: 6 }),
      ).toThrow(RangeError);
      expect(() =>
        estimateFuel({ distanceKm: 430, consumptionKmPerL: Number.POSITIVE_INFINITY, pricePerL: 6 }),
      ).toThrow(RangeError);
    });

    it('rejects negative distance', () => {
      expect(() => estimateFuel({ distanceKm: -1, consumptionKmPerL: 10, pricePerL: 6 }))
        .toThrow(RangeError);
    });

    it('rejects negative price', () => {
      expect(() => estimateFuel({ distanceKm: 430, consumptionKmPerL: 10, pricePerL: -6 }))
        .toThrow(RangeError);
    });

    it('rejects non-finite distance', () => {
      expect(() =>
        estimateFuel({ distanceKm: Number.POSITIVE_INFINITY, consumptionKmPerL: 10, pricePerL: 6 }),
      ).toThrow(RangeError);
    });

    it('never returns a negative or non-finite result for valid input', () => {
      const result = estimateFuel({ distanceKm: 1234.5, consumptionKmPerL: 0.1, pricePerL: 0 });
      expect(Number.isFinite(result.liters)).toBe(true);
      expect(result.liters).toBeGreaterThan(0);
      expect(result.cost).toBe(0);
    });
  });
});
