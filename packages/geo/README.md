# @qualroteiro/geo

Geospatial types and pure geodesic helpers for qualroteiro.

No network I/O, no HTTP client, no persistence. `GeocodeProvider` is declared
here as an **interface**; its implementations live in `apps/api`.

## Conventions

- **Positions are `[lng, lat]`** — GeoJSON axis order (RFC 7946 §3.1.1), which is
  also what MapLibre expects. `Position` is a tuple type, so a swapped pair is a
  compile error rather than a bug on a map.
- **Route geometry is a GeoJSON `LineString`**, not an encoded polyline. It needs
  no decoder downstream and `apps/web` can hand it straight to MapLibre. A
  provider that speaks encoded polyline decodes inside its own adapter.

## Helpers

| Function | Purpose |
|---|---|
| `haversineMeters(a, b)` | Great-circle distance between two positions. |
| `lineLengthMeters(line)` | Total length of a line. |
| `nearestPointOnLine(point, line)` | `{ point, distanceMeters, fractionAlong }`. |
| `isWithinBuffer(point, line, meters)` | Is the point within `meters` of the line? |
| `pointAtFraction(line, fraction)` | Position at 0…1 along the line. |
| `kmMarker(line, km)` | Position `km` kilometres along the line. |

## Why no `@turf/*`

qualroteiro needs exactly three primitives: great-circle distance,
point-to-segment projection, and interpolation along a line. Hand-rolling them
is ~120 lines and keeps this package's **runtime dependency list empty**, so
`dist/` has no transitive surface to audit for network access.

`nearestPointOnLine` projects each segment into a local equirectangular plane
centred on that segment's mean latitude. Over segment lengths of a few
kilometres the distortion is well under a metre — far inside the tolerance of
the ~500 m toll-matching buffer it exists to serve. The distance it *reports* is
then re-measured with haversine, so the number handed back is a true
great-circle distance.
