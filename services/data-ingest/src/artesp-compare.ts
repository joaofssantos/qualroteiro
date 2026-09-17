/**
 * Compares one matched (ARTESP, OSM) pair's tariffs — ARTESP `"Passeio"` vs
 * OSM `car`, ARTESP `"Comercial por eixo"` vs OSM `truck_N_axle` (scaled by
 * axle count), and, when present, ARTESP `"Motos"` vs OSM `motorcycle`.
 *
 * ## Why `Comercial por eixo` compares against `truck_N_axle / N`, not
 * `truck_2_axle` directly
 *
 * `artesp-pdf.ts`'s doc-comment documents a real finding: ARTESP's `Passeio`
 * and `Comercial por eixo` columns are numerically IDENTICAL on all 136 real
 * rows — `Comercial por eixo` is a **per-axle** base rate, not a flat
 * "commercial vehicle" price. A loaded truck's real ARTESP toll is
 * `tariffComercialPorEixo × (number of axles)`. OSM's own `truck_N_axle`
 * categories are built the exact same way (`osm-charge.ts`:
 * `hgvPerAxleBrl * axleCount`) — so the correct, apples-to-apples comparison
 * per axle category is `tariffComercialPorEixo` (ARTESP's per-axle rate)
 * against `osmTariff[category] / axleCountOf(category)` (OSM's own per-axle
 * rate, recovered by dividing back out), NOT against the raw
 * `osmTariff[category]` total. Both sides of the comparison end up
 * expressed in the same unit: BRL per axle.
 */

import type { AxleCategory, TariffByAxleCategory } from '@qualroteiro/tolls';

import type { ArtespTollRow } from './artesp-pdf.js';

/** Axle count encoded in each truck category's name — same table
 * `osm-charge.ts` uses to build `truck_N_axle` from OSM's per-axle `hgv`
 * rate in the first place. */
const TRUCK_AXLE_COUNTS: Readonly<Record<string, number>> = {
  truck_2_axle: 2,
  truck_3_axle: 3,
  truck_4_axle: 4,
  truck_5_axle: 5,
  truck_6_axle: 6,
};

export type ComparisonCategory = 'car' | 'motorcycle' | 'per_axle_commercial';

export interface TariffComparison {
  readonly category: ComparisonCategory;
  /** BRL. For `per_axle_commercial`, this is ARTESP's `Comercial por eixo`
   * value directly (already a per-axle rate). */
  readonly artespValue: number;
  /** BRL, same unit as `artespValue` — for `per_axle_commercial`, OSM's own
   * per-axle rate (`osmTariff[truck_N_axle] / N`), NOT the raw category
   * total. `undefined` when OSM has no value for this category at all (e.g.
   * no truck category in `osmTariff`, or ARTESP has no `Motos` column for
   * this row). */
  readonly osmValue: number | undefined;
  readonly absoluteDiff: number | undefined;
  readonly percentDiff: number | undefined;
  /** `true` when `absoluteDiff`/`percentDiff` cross {@link DivergenceThreshold}.
   * `undefined` (not `false`) when there is nothing to compare
   * (`osmValue` is `undefined`) — "no data" and "matches" are different
   * outcomes, and the report keeps them distinct rather than defaulting a
   * missing comparison to "bate". */
  readonly diverges: boolean | undefined;
}

export interface DivergenceThreshold {
  readonly percent: number;
  readonly absoluteBrl: number;
}

/**
 * Default divergence threshold, per orientation.md's own suggestion:
 * "diverge" when the absolute difference exceeds **both** R$1.00 or more
 * than the percentage cutoff (this module uses OR against the two
 * individually-scaled tests below, matching the spec's literal wording
 * "acima de 10% OU acima de R$1,00, o que for maior" read as "flagged by
 * whichever test is more sensitive at this price point" — at a R$3 plaza,
 * 10% is only R$0.30, so the R$1.00 floor is what actually fires; at a R$40
 * plaza, R$1.00 is only 2.5%, so the 10% test is what fires). Kept as the
 * default rather than hardcoded inline so a future tuning pass — or a
 * per-call override, same as `artesp-match.ts`'s `scoreThreshold` — has one
 * place to look.
 */
export const DEFAULT_DIVERGENCE_THRESHOLD: DivergenceThreshold = {
  percent: 0.1,
  absoluteBrl: 1.0,
};

function isDivergent(
  artespValue: number,
  osmValue: number,
  threshold: DivergenceThreshold,
): boolean {
  const absoluteDiff = Math.abs(artespValue - osmValue);
  if (absoluteDiff > threshold.absoluteBrl) return true;
  if (artespValue === 0) return absoluteDiff > 0;
  const percentDiff = absoluteDiff / artespValue;
  return percentDiff > threshold.percent;
}

function buildComparison(
  category: ComparisonCategory,
  artespValue: number,
  osmValue: number | undefined,
  threshold: DivergenceThreshold,
): TariffComparison {
  if (osmValue === undefined) {
    return {
      category,
      artespValue,
      osmValue: undefined,
      absoluteDiff: undefined,
      percentDiff: undefined,
      diverges: undefined,
    };
  }
  const absoluteDiff = Math.round((artespValue - osmValue) * 100) / 100;
  const percentDiff = artespValue === 0 ? undefined : Math.round((absoluteDiff / artespValue) * 1000) / 10;
  return {
    category,
    artespValue,
    osmValue,
    absoluteDiff,
    percentDiff,
    diverges: isDivergent(artespValue, osmValue, threshold),
  };
}

export interface PlazaTariffComparison {
  readonly comparisons: readonly TariffComparison[];
  /** `true` if ANY comparable category diverges (categories with no OSM
   * value to compare are excluded from this rollup, not treated as
   * divergent). `false` when every comparable category matches. `undefined`
   * when NO category had anything to compare at all (e.g. OSM tariff is
   * `null` — see `osm-toll-plazas.ts`: a cluster whose representative lane
   * had no parseable `charge` tag). */
  readonly overallDiverges: boolean | undefined;
}

/**
 * Compares one ARTESP row against its matched OSM plaza's tariff table.
 * `osmTariff` is `null` when the matched OSM row itself has no tariff
 * (`osm-toll-plazas.ts`'s `tariffMissing` case) — every category then comes
 * back as "no OSM value", not silently skipped from the report.
 */
export function compareTariffs(
  artespRow: Pick<ArtespTollRow, 'tariffPasseio' | 'tariffComercialPorEixo' | 'tariffMotos'>,
  osmTariff: TariffByAxleCategory | null,
  threshold: DivergenceThreshold = DEFAULT_DIVERGENCE_THRESHOLD,
): PlazaTariffComparison {
  const comparisons: TariffComparison[] = [];

  comparisons.push(
    buildComparison('car', artespRow.tariffPasseio, osmTariff?.car, threshold),
  );

  if (artespRow.tariffMotos !== undefined) {
    comparisons.push(
      buildComparison('motorcycle', artespRow.tariffMotos, osmTariff?.motorcycle, threshold),
    );
  }

  // ARTESP's per-axle commercial rate vs OSM's own per-axle rate, recovered
  // by dividing each truck category back down by its axle count — see this
  // module's doc-comment. Any one truck category found on the OSM side is
  // enough (they're all derived from the same single per-axle `hgv` rate in
  // `osm-charge.ts`, so they agree with each other by construction).
  let osmPerAxle: number | undefined;
  if (osmTariff) {
    for (const [category, axleCount] of Object.entries(TRUCK_AXLE_COUNTS)) {
      const value = osmTariff[category as AxleCategory];
      if (typeof value === 'number') {
        osmPerAxle = value / axleCount;
        break;
      }
    }
  }
  comparisons.push(
    buildComparison('per_axle_commercial', artespRow.tariffComercialPorEixo, osmPerAxle, threshold),
  );

  const comparable = comparisons.filter((c) => c.diverges !== undefined);
  const overallDiverges =
    comparable.length === 0 ? undefined : comparable.some((c) => c.diverges === true);

  return { comparisons, overallDiverges };
}
