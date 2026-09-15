/**
 * Tariff expansion.
 *
 * Brazilian toll plazas price by a well-known multiplier ladder applied to a
 * base fare — the fare a car (2 axles, single wheel) pays. The seed therefore
 * stores one base fare per plaza and expands it here, which keeps the data
 * legible and internally consistent instead of eight hand-typed numbers per
 * plaza that could silently drift out of proportion.
 */

import type { AxleCategory, TariffByAxleCategory } from './types.js';
import { AXLE_CATEGORIES } from './types.js';

/**
 * Multiplier applied to the base (car) fare for each category.
 *
 * `rodagem simples` = single rear wheels (passenger vehicles and their
 * trailers), `rodagem dupla` = twinned rear wheels (commercial vehicles).
 */
export const AXLE_MULTIPLIERS: Readonly<Record<AxleCategory, number>> = {
  /** Motocicleta — charged half the car fare. */
  motorcycle: 0.5,
  /** Automóvel / caminhonete — 2 axles, rodagem simples. The base fare. */
  car: 1,
  /** Automóvel com semirreboque — 3 axles, rodagem simples. */
  car_with_trailer: 1.5,
  /** Caminhão leve / ônibus — 2 axles, rodagem dupla. */
  truck_2_axle: 2,
  /** Caminhão / ônibus — 3 axles, rodagem dupla. */
  truck_3_axle: 3,
  truck_4_axle: 4,
  truck_5_axle: 5,
  truck_6_axle: 6,
};

const roundCents = (value: number): number => Math.round(value * 100) / 100;

/**
 * Expand a plaza's base car fare into a full tariff table.
 *
 * @param baseCarFareBrl the fare a car pays at this plaza, in BRL.
 * @throws {RangeError} if the base fare is not a positive finite number.
 */
export function tariffTable(baseCarFareBrl: number): TariffByAxleCategory {
  if (!Number.isFinite(baseCarFareBrl) || baseCarFareBrl <= 0) {
    throw new RangeError(
      `tariffTable: base car fare must be a positive finite number, received ${baseCarFareBrl}`,
    );
  }

  const table = {} as Record<AxleCategory, number>;
  for (const category of AXLE_CATEGORIES) {
    table[category] = roundCents(baseCarFareBrl * AXLE_MULTIPLIERS[category]);
  }
  return table;
}
