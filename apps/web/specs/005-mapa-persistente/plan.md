# Plan - persistent route map

1. Add endpoint marker state/actions to the route store.
2. Wrap the module routes in a persistent split layout that owns `MapCanvas`.
3. Update Tela 1 `PlaceSearch` handlers to publish selected endpoint places.
4. Remove map ownership from Tela 2 and keep only the result panel there.
5. Extend tests for Tela 1 endpoint markers and map container persistence.
