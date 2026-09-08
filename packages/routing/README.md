# @qualroteiro/routing

The routing provider **contract**. Interface and types only.

There is no provider implementation in this package and there must never be
one: the concrete adapters (a managed routing vendor now, a self-hosted Valhalla
later) are built in `apps/api`. That is what keeps this package's `dist/` free
of any HTTP client.

## The contract

```ts
interface RoutingProvider {
  route(req: RouteRequest): Promise<RouteResult>;
}
```

- `RouteRequest` — `{ origin, destination, waypoints?, profile? }`
- `RouteResult` — `{ routes: RouteAlternative[] }`
- `RouteAlternative` — `{ geometry, distanceKm, durationMin }`

`geometry` is a **GeoJSON `LineString`** with `[lng, lat]` positions.

## Designed to be swappable

- Single-method and `Promise`-returning: an async vendor adapter satisfies it
  as-is.
- No mention of an API key, a base URL or a transport — those belong to the
  adapter's own closure or constructor.
- `profile` is an open `string`, so vendor-specific profiles (`auto`, `truck`,
  `motorcycle`) pass through without editing this package.
- `routes` is always a list: a single-route vendor returns one element, an
  alternatives-capable vendor returns many, with no signature change.

An in-memory fake implementation lives in `tests/contract.test.ts` — test files
only, never `src/`.
