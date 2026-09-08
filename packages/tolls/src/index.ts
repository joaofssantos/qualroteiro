/**
 * `@qualroteiro/tolls` — toll plaza types, a hand-curated seed dataset, and
 * geometric matching of plazas to a route.
 *
 * Pure functions and static data only. No network I/O, no HTTP client, no
 * persistence. The seed is DEMO DATA — see the package README.
 */

export type {
  AxleCategory,
  Corridor,
  CorridorId,
  TariffByAxleCategory,
  TollPlaza,
} from './types.js';
export { AXLE_CATEGORIES } from './types.js';

export { AXLE_MULTIPLIERS, tariffTable } from './tariff.js';

export type { MatchTollsInput, MatchTollsResult } from './match.js';
export { TOLL_MATCH_BUFFER_METERS, matchTolls } from './match.js';

export {
  SEED_VERSION,
  bandeirantesCorridor,
  corridorPolyline,
  dutraCorridor,
  getCorridor,
  listCorridors,
  regisBittencourtCorridor,
} from './seed/index.js';
