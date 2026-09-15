# @qualroteiro/tolls

Toll plaza types, a hand-curated seed dataset, and geometric matching of plazas
to a route.

Pure functions and static data only — no network I/O, no HTTP client, no
persistence.

---

## ⚠️ The seed is DEMO DATA

Every plaza name, concessionaire, coordinate, corridor kilometre and fare under
`src/seed/` **approximates** the 2024–2025 real world. It was hand-curated so
the domain layer is testable before any real toll feed exists.

**It is not an authoritative source and must not be used for billing.** Fares
drift with every annual readjustment, plazas are added and removed, and the
reference polylines are coarse traces rather than survey-grade geometry.
Replacing this seed with a real ANTT/ARTESP feed is out of scope for this
package as delivered.

The dataset is versioned — `SEED_VERSION` — so a consumer can record which
vintage produced a stored quote.

---

## Usage

```ts
import { corridorPolyline, matchTolls } from '@qualroteiro/tolls';

const { plazas, total } = matchTolls({
  routeGeometry: corridorPolyline('sp-rj-dutra'),
  axleCategory: 'car',
});
// plazas: the six Dutra plazas, ordered along the route
// total:  52.9  (BRL)
```

## Matching

A plaza belongs to a route when its point lies within
**`TOLL_MATCH_BUFFER_METERS` = 500 m** of the route polyline.

500 m is wide enough to absorb the coarseness of a demo reference polyline and
the geometry simplification every routing vendor applies, yet narrow enough that
a tolled highway running parallel to the route does not falsely claim a plaza.
Override it per call with `bufferMeters`.

Matched plazas come back **ordered by their position along the route** — the
order the "points on route" panel renders. `total` is accumulated in integer
centavos and converted back at the end, so summing several fares cannot drift by
floating-point accumulation.

`corridorHint` restricts the search to one corridor. It is an optimisation and a
disambiguator, not a filter on the result.

## Corridors

| id | Route | Highway | Plazas |
|---|---|---|---|
| `sp-rj-dutra` | São Paulo – Rio de Janeiro (Rod. Presidente Dutra) | BR-116 | 6 |
| `sp-curitiba-regis-bittencourt` | São Paulo – Curitiba (Rod. Régis Bittencourt) | BR-116 | 6 |
| `sp-campinas-bandeirantes` | São Paulo – Campinas (Rod. dos Bandeirantes) | SP-348 | 2 |

`km` on a plaza is measured **along its corridor from the corridor's origin**
(São Paulo for all three), not the highway's official DNIT/DER kilometrage.
Corridor-relative kilometres are what the points-on-route panel needs, and they
stay consistent when a corridor crosses a state line and official kilometrage
restarts.

Corridor reference polylines deliberately run a couple of hundred metres to the
side of each plaza rather than exactly through it, so buffer matching is
genuinely exercised by the tests instead of trivially satisfied by identical
coordinates.

## Tariffs

Plazas price by axle count and wheel type (*rodagem simples* vs *dupla*), the
Brazilian convention. The seed stores **one base car fare per plaza** and
`tariffTable()` expands it through the standard multiplier ladder
(`AXLE_MULTIPLIERS`): motorcycle ½, car 1, car + semi-trailer 1.5, 2-axle
commercial 2, 3-axle 3, and so on to 6.

This keeps the data legible and internally consistent, instead of eight
hand-typed numbers per plaza that could silently drift out of proportion.
