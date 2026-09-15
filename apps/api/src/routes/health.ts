/**
 * `GET /health` — liveness. Deliberately touches no provider and no database,
 * so it stays true even when every upstream is down.
 */

import type { FastifyInstance } from 'fastify';

export function registerHealthRoute(app: FastifyInstance): void {
  app.get('/health', async () => ({ status: 'ok' }));
}
