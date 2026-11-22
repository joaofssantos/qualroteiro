# Deploy: Render

The API runs behind one Render reverse-proxy hop. `render.yaml` therefore sets
`TRUST_PROXY=1`: Fastify trusts only that immediate proxy when resolving
`request.ip`, so `POST /routes/plan` rate limits the real client rather than a
single shared Render IP. Do not set this to `true` or a larger hop count unless
the network topology is verified: it would let an untrusted `X-Forwarded-For`
entry select a different rate-limit bucket.

`TRUST_PROXY` is disabled by default outside Render. It accepts a positive hop
count or a comma-separated CIDR allow-list. The rate-limit store is in memory
per API process, so separate replicas do not share a bucket.

Keep `DATABASE_URL`, `DIRECT_DATABASE_URL`, `ORS_API_KEY`,
`CLERK_SECRET_KEY`, `GOOGLE_PLACES_API_KEY`, and `CORS_ORIGIN` as Render secret
environment variables; do not commit their values.
