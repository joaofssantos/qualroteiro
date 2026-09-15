/**
 * The versioned, in-package toll seed.
 *
 * DEMO DATA. Every plaza name, concessionaire, coordinate, corridor kilometre
 * and fare in this directory approximates the 2024–2025 real world. It is a
 * hand-curated seed for three corridors, deliberately checked into the package
 * so the domain layer is testable before any real toll feed exists. It is NOT
 * authoritative and must not be used for billing. See the package README.
 */

import type { LineString } from '@qualroteiro/geo';

import type { Corridor, CorridorId } from '../types.js';
import { bandeirantesCorridor } from './bandeirantes.js';
import { dutraCorridor } from './dutra.js';
import { regisBittencourtCorridor } from './regis-bittencourt.js';

/**
 * Seed version. Bump when plazas or fares change, so a consumer can tell which
 * vintage of the data produced a stored quote.
 */
export const SEED_VERSION = '2025.01-demo';

const CORRIDORS: Readonly<Record<CorridorId, Corridor>> = {
  'sp-rj-dutra': dutraCorridor,
  'sp-curitiba-regis-bittencourt': regisBittencourtCorridor,
  'sp-campinas-bandeirantes': bandeirantesCorridor,
};

/** Every seeded corridor. */
export function listCorridors(): readonly Corridor[] {
  return Object.values(CORRIDORS);
}

/**
 * Look up one corridor by id.
 *
 * @throws {RangeError} if the id is not in the seed.
 */
export function getCorridor(id: CorridorId): Corridor {
  const corridor = CORRIDORS[id];
  if (corridor === undefined) {
    const known = Object.keys(CORRIDORS).join(', ');
    throw new RangeError(`getCorridor: unknown corridor '${id}'. Known corridors: ${known}`);
  }
  return corridor;
}

/**
 * The reference polyline for a corridor — a coarse demo trace, useful as a
 * stand-in route until a real routing provider is wired in.
 *
 * @throws {RangeError} if the id is not in the seed.
 */
export function corridorPolyline(id: CorridorId): LineString {
  return getCorridor(id).referencePolyline;
}

export { bandeirantesCorridor, dutraCorridor, regisBittencourtCorridor };
