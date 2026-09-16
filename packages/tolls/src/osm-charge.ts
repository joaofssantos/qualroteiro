/**
 * Parsing of OpenStreetMap's `charge` tag on `barrier=toll_booth` nodes.
 *
 * A live Overpass query over SP-and-surrounding toll booths (see
 * `.aipe/journeys/j-20260916-y9/orientation.md`) found the tag's values fall
 * into exactly four structural patterns — see {@link parseOsmCharge}. No
 * other shape is handled: this is external data from thousands of independent
 * mappers, so anything unrecognized is a `null` return, never an exception.
 */

import type { AxleCategory, TariffByAxleCategory } from './types.js';

const roundCents = (value: number): number => Math.round(value * 100) / 100;

/** The three vehicle classes OSM's `charge` tag distinguishes. */
type OsmVehicleClass = 'motorcar' | 'motorcycle' | 'hgv' | 'hgva';

/** Number of axles implied by each truck category, for the hgv-per-axle multiplication. */
const TRUCK_AXLE_COUNTS: Readonly<
  Record<'truck_2_axle' | 'truck_3_axle' | 'truck_4_axle' | 'truck_5_axle' | 'truck_6_axle', number>
> = {
  truck_2_axle: 2,
  truck_3_axle: 3,
  truck_4_axle: 4,
  truck_5_axle: 5,
  truck_6_axle: 6,
};

/**
 * One `dayRange amountBRL/vehicleClass[/axle]` entry within a `charge` value.
 *
 * Matches all four documented patterns:
 *  - `14.50BRL/motorcar` — no day range, no axle suffix.
 *  - `14.50BRL/hgv/axle` — the common per-axle heavy-vehicle suffix.
 *  - `14.50BRL/hgva/axle` — the `hgva` spelling variant, same semantics.
 *  - `Mo-Fr 14.50BRL/motorcar` — a day-range-scoped entry.
 *
 * `(hgva|hgv)` is tried in that order, but the trailing `(?:\/axle)?$`
 * anchors mean a `hgva` value would still match correctly even in the
 * opposite order — the engine backtracks off a failed `hgv` match that
 * leaves a stray `a` unconsumed before the end of the segment.
 */
const CHARGE_ENTRY_PATTERN =
  /^(?:(Mo-Fr|Sa-Su)\s+)?(\d+(?:\.\d+)?)BRL\/(motorcar|motorcycle|hgva|hgv)(?:\/axle)?$/;

interface ChargeEntry {
  readonly dayRange: 'Mo-Fr' | 'Sa-Su' | undefined;
  readonly amountBrl: number;
  readonly vehicleClass: OsmVehicleClass;
}

function parseEntries(chargeTag: string): ChargeEntry[] | null {
  const segments = chargeTag.split(';');
  const entries: ChargeEntry[] = [];

  for (const segment of segments) {
    const match = CHARGE_ENTRY_PATTERN.exec(segment.trim());
    if (match === null) return null;

    const [, dayRange, amountText, vehicleClass] = match;
    const amountBrl = Number(amountText);
    if (!Number.isFinite(amountBrl) || amountBrl < 0) return null;

    entries.push({
      dayRange: dayRange as 'Mo-Fr' | 'Sa-Su' | undefined,
      amountBrl,
      vehicleClass: vehicleClass as OsmVehicleClass,
    });
  }

  return entries;
}

/**
 * Parse an OSM `charge` tag value into a full {@link TariffByAxleCategory}.
 *
 * ## The four known patterns
 *
 * 1. `"14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgv/axle"` — the common
 *    case: one entry per vehicle class, `hgv` carrying an explicit `/axle`
 *    per-axle-fare suffix.
 * 2. `"14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgv"` — same shape, `hgv`
 *    without the `/axle` suffix. Semantically identical to (1): OSM's `hgv`
 *    charge is per-axle whether or not the mapper spelled out `/axle`.
 * 3. `"14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgva/axle"` — the `hgva`
 *    spelling variant in place of `hgv`, same per-axle semantics.
 * 4. `"Mo-Fr 14.50BRL/motorcar;...;Sa-Su 18.00BRL/motorcar;..."` — weekday vs.
 *    weekend fares. **V1 only uses the `Mo-Fr` (weekday) entries** — `Sa-Su`
 *    entries are dropped. Documented limit, not a bug: weekend differential
 *    pricing is out of scope for this phase.
 *
 * ## Category mapping
 *
 * OSM only distinguishes `motorcycle` / `motorcar` / `hgv` (per axle) — three
 * classes against the app's eight {@link AxleCategory}s:
 *  - `motorcycle` → `motorcycle`, unchanged.
 *  - `motorcar` → **both** `car` and `car_with_trailer`, the same value for
 *    both — OSM has no tag distinguishing a car towing a trailer.
 *  - `hgv`/`hgva` (per-axle BRL) → `truck_2_axle` … `truck_6_axle`, each
 *    computed as `hgvPerAxleBrl * N` where `N` is the axle count the category
 *    name encodes (2 through 6). This mirrors the *shape* of the
 *    `AXLE_MULTIPLIERS` ladder in `tariff.ts` — more axles pay proportionally
 *    more — but starts from OSM's own per-axle heavy-vehicle rate instead of
 *    expanding a car base fare, since that is the only heavy-vehicle number
 *    OSM actually publishes. (`AXLE_MULTIPLIERS` itself is not reused
 *    numerically here: it prices a *car-base* ladder that also encodes
 *    rodagem-simples-vs-dupla, a distinction the flat OSM per-axle rate does
 *    not carry.)
 *
 * A `charge` value not matching one of the four patterns above, or missing
 * one of the three required vehicle classes after filtering, returns `null`.
 * Never throws — this is unvalidated external data from many independent
 * mappers, and a malformed tag should mean "skip this plaza's tariff", not
 * crash the caller.
 */
export function parseOsmCharge(chargeTag: string): TariffByAxleCategory | null {
  if (chargeTag.trim().length === 0) return null;

  const allEntries = parseEntries(chargeTag);
  if (allEntries === null) return null;

  // Pattern 4 (Mo-Fr/Sa-Su): keep weekday entries and untagged entries, drop
  // weekend-only ones. For patterns 1-3 (no entry carries a dayRange) this is
  // a no-op — every entry is kept.
  const entries = allEntries.filter((entry) => entry.dayRange !== 'Sa-Su');
  if (entries.length === 0) return null;

  const amountByClass = new Map<OsmVehicleClass, number>();
  for (const entry of entries) {
    // Last entry for a class wins; the real data never repeats a class within
    // the kept (Mo-Fr/untagged) entries, but this keeps parsing total.
    amountByClass.set(entry.vehicleClass, entry.amountBrl);
  }

  const motorcarBrl = amountByClass.get('motorcar');
  const motorcycleBrl = amountByClass.get('motorcycle');
  const hgvPerAxleBrl = amountByClass.get('hgv') ?? amountByClass.get('hgva');

  if (motorcarBrl === undefined || motorcycleBrl === undefined || hgvPerAxleBrl === undefined) {
    return null;
  }

  const table = {
    motorcycle: roundCents(motorcycleBrl),
    car: roundCents(motorcarBrl),
    car_with_trailer: roundCents(motorcarBrl),
  } as Record<AxleCategory, number>;

  for (const [category, axleCount] of Object.entries(TRUCK_AXLE_COUNTS) as [
    keyof typeof TRUCK_AXLE_COUNTS,
    number,
  ][]) {
    table[category] = roundCents(hgvPerAxleBrl * axleCount);
  }

  return table;
}
