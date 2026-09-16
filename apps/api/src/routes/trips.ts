/**
 * `/trips*` — the F2a composition layer's HTTP surface.
 *
 * Shapes are fixed by `F2-COORDINATION.md` §3, which `apps/web` was released
 * to build against before this unit started. Nothing here may drift from it.
 *
 * ## Why every route lives inside one `register` call
 *
 * The auth `preHandler` is attached to the encapsulated instance, not to the
 * root app. Fastify's encapsulation then makes it structurally impossible for
 * the hook to reach `/routes/plan`, `/places/search` or `/health` — F1 stays
 * anonymous because the hook is not in its scope, not because the hook checks
 * the path and remembers to let it through (plan.md D-507).
 */

import type { FastifyInstance } from 'fastify';

import { extractBearerToken, requireUserId } from '../auth/verifier.js';
import type { AuthVerifier } from '../auth/verifier.js';
import { NotFoundError } from '../errors.js';
import {
  parseCreateDay,
  parseCreateItem,
  parseCreateTrip,
  parseUpdateDay,
  parseUpdateItem,
  parseUpdateTrip,
} from '../http/trips-validate.js';
import type { TripStore } from '../store/trips.js';

export interface TripRoutesDeps {
  readonly auth: AuthVerifier;
  readonly trips: TripStore;
}

/**
 * One message per nesting level, used for "does not exist" and "is not yours"
 * alike. §3 requires a non-owner to learn nothing, so these strings must not
 * become more specific — the store already returns an undifferentiated
 * `null`/`false`, and naming which part was missing would hand back exactly
 * the information the rule exists to withhold.
 */
const TRIP_NOT_FOUND = 'trip not found';
const DAY_NOT_FOUND = 'trip or day not found';
const ITEM_NOT_FOUND = 'trip, day or item not found';

interface TripParams {
  id: string;
}
interface DayParams extends TripParams {
  dayId: string;
}
interface ItemParams extends DayParams {
  itemId: string;
}

export function registerTripRoutes(app: FastifyInstance, deps: TripRoutesDeps): void {
  void app.register(async (scoped) => {
    scoped.addHook('preHandler', async (request) => {
      // Throws UnauthorizedError (→ 401); app.ts maps it. Nothing downstream
      // runs unless this assigns a verified id.
      const token = extractBearerToken(request.headers.authorization);
      const { userId } = await deps.auth.verifyBearerToken(token);
      request.authUserId = userId;
    });

    scoped.post('/trips', async (request, reply) => {
      const userId = requireUserId(request);
      const input = parseCreateTrip(request.body);

      const trip = await deps.trips.createTrip({ userId, ...input });
      return reply.status(201).send(trip);
    });

    scoped.get('/trips', async (request) => {
      const userId = requireUserId(request);
      return { trips: await deps.trips.listTrips(userId) };
    });

    scoped.get<{ Params: TripParams }>('/trips/:id', async (request) => {
      const userId = requireUserId(request);

      const detail = await deps.trips.getTripDetail(userId, request.params.id);
      if (detail === null) throw new NotFoundError(TRIP_NOT_FOUND);

      return detail;
    });

    scoped.patch<{ Params: TripParams }>('/trips/:id', async (request) => {
      const userId = requireUserId(request);
      const { id } = request.params;

      // Read before validating: the date-ordering rule spans both dates, so a
      // one-field patch can only be judged against what is stored.
      const current = await deps.trips.findTrip(userId, id);
      if (current === null) throw new NotFoundError(TRIP_NOT_FOUND);

      const patch = parseUpdateTrip(request.body, current);

      const updated = await deps.trips.updateTrip(userId, id, patch);
      if (updated === null) throw new NotFoundError(TRIP_NOT_FOUND);

      return updated;
    });

    scoped.delete<{ Params: TripParams }>('/trips/:id', async (request, reply) => {
      const userId = requireUserId(request);

      const deleted = await deps.trips.deleteTrip(userId, request.params.id);
      if (!deleted) throw new NotFoundError(TRIP_NOT_FOUND);

      return reply.status(204).send();
    });

    scoped.post<{ Params: TripParams }>('/trips/:id/days', async (request, reply) => {
      const userId = requireUserId(request);
      const input = parseCreateDay(request.body);

      const day = await deps.trips.createDay(userId, request.params.id, input);
      if (day === null) throw new NotFoundError(TRIP_NOT_FOUND);

      return reply.status(201).send(day);
    });

    scoped.patch<{ Params: DayParams }>('/trips/:id/days/:dayId', async (request) => {
      const userId = requireUserId(request);
      const { id, dayId } = request.params;
      const input = parseUpdateDay(request.body);

      const day = await deps.trips.updateDay(userId, id, dayId, input);
      if (day === null) throw new NotFoundError(DAY_NOT_FOUND);

      return day;
    });

    scoped.post<{ Params: DayParams }>(
      '/trips/:id/days/:dayId/items',
      async (request, reply) => {
        const userId = requireUserId(request);
        const { id, dayId } = request.params;
        const input = parseCreateItem(request.body);

        const item = await deps.trips.createItem(userId, id, dayId, input);
        if (item === null) throw new NotFoundError(DAY_NOT_FOUND);

        return reply.status(201).send(item);
      },
    );

    scoped.delete<{ Params: ItemParams }>(
      '/trips/:id/days/:dayId/items/:itemId',
      async (request, reply) => {
        const userId = requireUserId(request);
        const { id, dayId, itemId } = request.params;

        const deleted = await deps.trips.deleteItem(userId, id, dayId, itemId);
        if (!deleted) throw new NotFoundError(ITEM_NOT_FOUND);

        return reply.status(204).send();
      },
    );

    scoped.patch<{ Params: ItemParams }>(
      '/trips/:id/days/:dayId/items/:itemId',
      async (request) => {
        const userId = requireUserId(request);
        const { id, dayId, itemId } = request.params;
        const input = parseUpdateItem(request.body);

        const item = await deps.trips.updateItem(userId, id, dayId, itemId, input);
        if (item === null) throw new NotFoundError(ITEM_NOT_FOUND);

        return item;
      },
    );
  });
}
