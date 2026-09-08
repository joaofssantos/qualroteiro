# Relations

## qualroteiro

### qualroteiro
- _No known relations._

### qualroteiro/api
- shares-infra → qualroteiro/root
  - Connects to the shared PostgreSQL/PostGIS database from the root infra/docker-compose.yml via DATABASE_URL. (apps/api/.env.example:1)
  - Uses the shared Redis, Valhalla, and Photon services provisioned by the root infra/docker-compose.yml via REDIS_URL, VALHALLA_URL, and PHOTON_URL. (apps/api/.env.example:2)
- consumes → qualroteiro/web
  - Exposes a Fastify HTTP server with CORS enabled on port 3000, an API surface intended to be called by the browser frontend. (apps/api/src/server.ts:5)

### qualroteiro/root
- qualroteiro/api → shares-infra → this
  - Connects to the shared PostgreSQL/PostGIS database from the root infra/docker-compose.yml via DATABASE_URL. (apps/api/.env.example:1)
  - Uses the shared Redis, Valhalla, and Photon services provisioned by the root infra/docker-compose.yml via REDIS_URL, VALHALLA_URL, and PHOTON_URL. (apps/api/.env.example:2)

### qualroteiro/web
- qualroteiro/api → consumes → this
  - Exposes a Fastify HTTP server with CORS enabled on port 3000, an API surface intended to be called by the browser frontend. (apps/api/src/server.ts:5)
