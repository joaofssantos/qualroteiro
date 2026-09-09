# @qualroteiro/fuel

Fuel consumption and cost arithmetic for the **Rota & Custos (F1)** module.

Pure functions only — no network I/O, no HTTP client, no persistence.

## Usage

```ts
import { estimateFuel } from '@qualroteiro/fuel';

estimateFuel({ distanceKm: 430, consumptionKmPerL: 10, pricePerL: 6 });
// → { liters: 43, cost: 258 }
```

## Behaviour

- `liters = distanceKm / consumptionKmPerL`, reported to 3 decimals.
- `cost = liters * pricePerL`, reported to 2 decimals (BRL cents).
- `cost` is derived from the **unrounded** litres, so the money figure does not
  inherit the litre rounding error.

## Guards

`estimateFuel` throws `RangeError` rather than returning a nonsense number when:

- `consumptionKmPerL` is zero or negative (which would yield `Infinity` or a
  negative cost);
- any input is non-finite (`NaN`, `Infinity`);
- `distanceKm` or `pricePerL` is negative.
