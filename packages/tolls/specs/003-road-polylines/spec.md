# T3 — Road-Following Corridor Polylines

## Goal

Replace the coarse demo `referencePolyline` data for the three seeded toll corridors with frozen road-following traces.

## Scope

- Update only `packages/tolls`.
- Keep corridor ids, plazas, tariffs, and public matching APIs unchanged.
- Keep each `referencePolyline` as a GeoJSON `LineString`.
- Ensure each seeded plaza remains within the default 500 m toll matching buffer of its own corridor polyline.

## Acceptance

- `sp-rj-dutra`, `sp-curitiba-regis-bittencourt`, and `sp-campinas-bandeirantes` each have at least 50 reference polyline coordinates.
- Existing `matchTolls` behavior remains stable, including the Dutra total of `52.9`.
- Tests cover plaza-to-polyline buffer consistency and minimum polyline density.
