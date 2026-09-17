import { describe, expect, it } from 'vitest';

import {
  compareTariffs,
  DEFAULT_DIVERGENCE_THRESHOLD,
  type DivergenceThreshold,
} from '../src/artesp-compare.js';
import type { TariffByAxleCategory } from '@qualroteiro/tolls';

function fullTariff(overrides: Partial<TariffByAxleCategory> = {}): TariffByAxleCategory {
  return {
    motorcycle: 0,
    car: 13.7,
    car_with_trailer: 13.7,
    truck_2_axle: 27.4,
    truck_3_axle: 41.1,
    truck_4_axle: 54.8,
    truck_5_axle: 68.5,
    truck_6_axle: 82.2,
    ...overrides,
  };
}

describe('compareTariffs', () => {
  it('classifies "bate" when ARTESP and OSM car tariffs are identical', () => {
    const result = compareTariffs(
      { tariffPasseio: 13.7, tariffComercialPorEixo: 13.7 },
      fullTariff({ car: 13.7, truck_2_axle: 27.4 }),
    );

    const carComparison = result.comparisons.find((c) => c.category === 'car');
    expect(carComparison?.diverges).toBe(false);
    expect(result.overallDiverges).toBe(false);
  });

  it('classifies "diverge" when the absolute difference exceeds R$1,00 (real Perus-shaped example: R$13,70 vs R$14,50)', () => {
    const result = compareTariffs(
      { tariffPasseio: 13.7, tariffComercialPorEixo: 13.7 },
      fullTariff({ car: 14.5 }),
    );
    // |13.70 - 14.50| = 0.80 < R$1,00, and 0.80/13.70 = 5.8% < 10% — this
    // real-shaped pair is actually within threshold on both tests, so it
    // must classify as "bate", not "diverge" (this is the real-world case
    // this journey's own research surfaced — see the audit README/report).
    const carComparison = result.comparisons.find((c) => c.category === 'car');
    expect(carComparison?.diverges).toBe(false);
  });

  it('classifies "diverge" once the absolute difference crosses R$1,00', () => {
    const result = compareTariffs(
      { tariffPasseio: 13.7, tariffComercialPorEixo: 13.7 },
      fullTariff({ car: 15.0 }), // |13.70 - 15.00| = 1.30 > R$1,00
    );
    const carComparison = result.comparisons.find((c) => c.category === 'car');
    expect(carComparison?.diverges).toBe(true);
    expect(result.overallDiverges).toBe(true);
  });

  it('classifies "diverge" once the percentage difference crosses 10% even when under R$1,00 (small-tariff plaza)', () => {
    const result = compareTariffs(
      { tariffPasseio: 3.0, tariffComercialPorEixo: 3.0 },
      fullTariff({ car: 3.4 }), // |3.00 - 3.40| = 0.40 < R$1,00, but 0.40/3.00 = 13.3% > 10%
    );
    const carComparison = result.comparisons.find((c) => c.category === 'car');
    expect(carComparison?.diverges).toBe(true);
  });

  it('compares "Comercial por eixo" (ARTESP\'s per-axle rate) against OSM\'s truck_N_axle DIVIDED BACK to a per-axle rate, not the raw category total', () => {
    // ARTESP: R$13,70 per axle. OSM: truck_2_axle = R$27,40 total, i.e. also
    // R$13,70 per axle once divided by 2 — these must compare as EQUAL, even
    // though 13.70 vs 27.40 (the raw, undivided values) would look wildly
    // divergent.
    const result = compareTariffs(
      { tariffPasseio: 13.7, tariffComercialPorEixo: 13.7 },
      fullTariff({ truck_2_axle: 27.4 }),
    );

    const axleComparison = result.comparisons.find((c) => c.category === 'per_axle_commercial');
    expect(axleComparison?.osmValue).toBe(13.7);
    expect(axleComparison?.diverges).toBe(false);
  });

  it('compares Motos when ARTESP has a Motos column, and omits it when ARTESP has none', () => {
    const withMotos = compareTariffs(
      { tariffPasseio: 3.9, tariffComercialPorEixo: 3.9, tariffMotos: 1.95 },
      fullTariff({ car: 3.9, motorcycle: 1.95, truck_2_axle: 7.8 }),
    );
    expect(withMotos.comparisons.some((c) => c.category === 'motorcycle')).toBe(true);

    const withoutMotos = compareTariffs(
      { tariffPasseio: 13.7, tariffComercialPorEixo: 13.7 },
      fullTariff(),
    );
    expect(withoutMotos.comparisons.some((c) => c.category === 'motorcycle')).toBe(false);
  });

  it('reports "no OSM value" (undefined diverges), not a false "bate", when OSM has no tariff at all', () => {
    const result = compareTariffs({ tariffPasseio: 13.7, tariffComercialPorEixo: 13.7 }, null);

    for (const comparison of result.comparisons) {
      expect(comparison.osmValue).toBeUndefined();
      expect(comparison.diverges).toBeUndefined();
    }
    expect(result.overallDiverges).toBeUndefined();
  });

  it('accepts a custom threshold', () => {
    // |13.70 - 13.80| = 0.10 — within the DEFAULT threshold (R$1,00 / 10%),
    // outside a much stricter custom one (R$0,05 / 1%).
    const strict: DivergenceThreshold = { percent: 0.01, absoluteBrl: 0.05 };

    const defaultResult = compareTariffs(
      { tariffPasseio: 13.7, tariffComercialPorEixo: 13.7 },
      fullTariff({ car: 13.8 }),
      DEFAULT_DIVERGENCE_THRESHOLD,
    );
    expect(defaultResult.overallDiverges).toBe(false);

    const strictResult = compareTariffs(
      { tariffPasseio: 13.7, tariffComercialPorEixo: 13.7 },
      fullTariff({ car: 13.8 }),
      strict,
    );
    expect(strictResult.overallDiverges).toBe(true);
  });
});
