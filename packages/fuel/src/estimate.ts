/**
 * Fuel cost arithmetic. Pure functions, no I/O.
 */

/** Input to {@link estimateFuel}. */
export interface FuelEstimateInput {
  /** Distance to be driven, in kilometres. Must be finite and >= 0. */
  readonly distanceKm: number;
  /** Vehicle consumption, in kilometres per litre. Must be finite and > 0. */
  readonly consumptionKmPerL: number;
  /** Fuel price, in BRL per litre. Must be finite and >= 0. */
  readonly pricePerL: number;
}

/** Result of {@link estimateFuel}. */
export interface FuelEstimate {
  /** Litres burned, rounded to 3 decimals. */
  readonly liters: number;
  /** Cost in BRL, rounded to 2 decimals (cents). */
  readonly cost: number;
}

const roundTo = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`estimateFuel: ${name} must be a finite number, received ${value}`);
  }
}

/**
 * Estimate the fuel burned and the money spent over a distance.
 *
 * `liters = distanceKm / consumptionKmPerL`, `cost = liters * pricePerL`.
 *
 * Rounding: `cost` is derived from the **unrounded** liters and only then
 * rounded to 2 decimals, so the money figure does not inherit the litre
 * rounding error. `liters` is reported to 3 decimals.
 *
 * @throws {RangeError} if any input is non-finite, if `consumptionKmPerL` is
 * not strictly positive (which would otherwise yield `Infinity` or a negative
 * cost), or if `distanceKm` / `pricePerL` are negative.
 */
export function estimateFuel(input: FuelEstimateInput): FuelEstimate {
  const { distanceKm, consumptionKmPerL, pricePerL } = input;

  assertFinite(distanceKm, 'distanceKm');
  assertFinite(consumptionKmPerL, 'consumptionKmPerL');
  assertFinite(pricePerL, 'pricePerL');

  if (consumptionKmPerL <= 0) {
    throw new RangeError(
      `estimateFuel: consumptionKmPerL must be greater than 0, received ${consumptionKmPerL}`,
    );
  }
  if (distanceKm < 0) {
    throw new RangeError(`estimateFuel: distanceKm must not be negative, received ${distanceKm}`);
  }
  if (pricePerL < 0) {
    throw new RangeError(`estimateFuel: pricePerL must not be negative, received ${pricePerL}`);
  }

  const rawLiters = distanceKm / consumptionKmPerL;

  return {
    liters: roundTo(rawLiters, 3),
    cost: roundTo(rawLiters * pricePerL, 2),
  };
}
