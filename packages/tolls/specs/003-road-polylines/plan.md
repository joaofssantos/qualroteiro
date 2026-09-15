# Plan

1. Fetch one-shot OSRM `driving` GeoJSON routes using the existing seed endpoints and plaza waypoints for each corridor.
2. Simplify the returned geometries with Douglas-Peucker in metre space to keep bundle size bounded.
3. Freeze the simplified coordinates in the existing seed files.
4. Strengthen seed tests to require at least 50 coordinates per corridor and preserve 500 m plaza buffer coverage.
5. Run `@qualroteiro/geo` build first, then `@qualroteiro/tolls` build, typecheck, and test.

## Captured Counts

- Dutra: OSRM 7,228 points -> 305 frozen points, 100 m simplification.
- Regis Bittencourt: OSRM 8,215 points -> 389 frozen points, 125 m simplification.
- Bandeirantes: OSRM 2,864 points -> 110 frozen points, 100 m simplification.
