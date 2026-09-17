import { describe, expect, it } from 'vitest';

import { calculateActivityCost, type ActivityPlan } from './calc';

const PLAN: ActivityPlan = {
  placeName: 'Passeio de barco',
  address: null,
  date: '2026-10-02',
  pricePerPerson: 150,
  people: 2,
};

describe('calculateActivityCost', () => {
  it('calculates the total cost for a normal case', () => {
    expect(calculateActivityCost(PLAN)).toEqual({ totalCost: 300 });
  });

  it('rejects fewer than one person', () => {
    expect(() => calculateActivityCost({ ...PLAN, people: 0 })).toThrow(
      'Informe pelo menos uma pessoa.',
    );
  });

  it('rejects a negative price per person', () => {
    expect(() => calculateActivityCost({ ...PLAN, pricePerPerson: -1 })).toThrow(
      'O preço por pessoa não pode ser negativo.',
    );
  });
});
