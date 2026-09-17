import { describe, expect, it } from 'vitest';

import { calculateLodgingCost, type LodgingStay } from './calc';

const STAY: LodgingStay = {
  placeName: 'Hotel Atlântico',
  address: null,
  lat: null,
  lng: null,
  checkIn: '2026-10-01',
  checkOut: '2026-10-04',
  pricePerNight: 250,
};

describe('calculateLodgingCost', () => {
  it('calculates nights and total cost for a normal stay', () => {
    expect(calculateLodgingCost(STAY)).toEqual({ nights: 3, totalCost: 750 });
  });

  it('calculates a one-night stay', () => {
    expect(
      calculateLodgingCost({
        ...STAY,
        checkIn: '2026-10-01',
        checkOut: '2026-10-02',
      }),
    ).toEqual({ nights: 1, totalCost: 250 });
  });

  it('rejects checkout on or before check-in', () => {
    expect(() =>
      calculateLodgingCost({
        ...STAY,
        checkOut: '2026-10-01',
      }),
    ).toThrow('checkOut must be after checkIn');
  });

  it('rejects a negative nightly price in Portuguese', () => {
    expect(() => calculateLodgingCost({ ...STAY, pricePerNight: -1 })).toThrow(
      'O preço por noite não pode ser negativo.',
    );
  });
});
