import { describe, expect, it } from 'vitest';

import { calculateRestaurantCost } from './calc';

describe('calculateRestaurantCost', () => {
  it('multiplies price per person by people', () => {
    expect(
      calculateRestaurantCost({
        placeName: 'Casa do Porco',
        address: 'Rua Araujo, 124',
        lat: -23.561,
        lng: -46.66,
        date: '2026-10-12',
        pricePerPerson: 120,
        people: 3,
      }),
    ).toEqual({ totalCost: 360 });
  });

  it('accepts one person', () => {
    expect(
      calculateRestaurantCost({
        placeName: 'Padaria da Esquina',
        address: null,
        lat: null,
        lng: null,
        date: null,
        pricePerPerson: 32.5,
        people: 1,
      }),
    ).toEqual({ totalCost: 32.5 });
  });

  it('rejects less than one person', () => {
    expect(() =>
      calculateRestaurantCost({
        placeName: 'Café',
        address: null,
        lat: null,
        lng: null,
        date: null,
        pricePerPerson: 20,
        people: 0,
      }),
    ).toThrow('pelo menos uma pessoa');
  });

  it('rejects a negative price per person', () => {
    expect(() =>
      calculateRestaurantCost({
        placeName: 'Café',
        address: null,
        lat: null,
        lng: null,
        date: null,
        pricePerPerson: -1,
        people: 2,
      }),
    ).toThrow('não pode ser negativo');
  });
});
