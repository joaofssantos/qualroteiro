# sdd-lite - `apps/web` persistent route map

## Problem

The "Rota & Custos" map was mounted only on the result screen. Tela 1 let a user
choose origin, destination and stops without spatial feedback, and navigating to
the result recreated the MapLibre instance.

## Scope

- Keep a single `MapCanvas` mounted in the module layout for Tela 1 and Tela 2.
- Draw selected origin, destination and waypoint places as markers before submit.
- Draw no route trace until the result route is visible.
- Preserve the existing result trace, toll marker, fuel marker and alternative
selection behavior.
- Keep the shell/module registry contracts unchanged.

## Decision

Endpoint markers live in `routeStore` because the form produces them while the
module layout consumes them. This avoids moving form state into the layout and
keeps `MapCanvas` on the same layer-based API used by route points.

## Acceptance

- Tela 1 shows the map immediately.
- Selecting Sao Paulo and Rio de Janeiro from `PlaceSearch` renders two endpoint
  markers without submitting the route plan.
- Submit navigates to Tela 2 with the active route geometry as the trace.
- The map container persists across Tela 1 -> Tela 2 navigation.
- Selecting another route alternative updates the trace.
