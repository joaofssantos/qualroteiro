/**
 * `GET /admin/toll-plazas-status` — T5 Wave 2 (`j-20260916-9y`).
 */

import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import {
  DUTRA_TOLL_PLAZA_RECORDS,
  fakeGeocodeProvider,
  fakeRoutingProvider,
  fakeTollPlazaStore,
} from './helpers/fakes.js';

function appWith(tollPlazas: Parameters<typeof buildApp>[0]['tollPlazas']) {
  return buildApp({
    routing: fakeRoutingProvider(),
    geocode: fakeGeocodeProvider(),
    tollPlazas,
  });
}

describe('GET /admin/toll-plazas-status', () => {
  it('returns count 0 and lastIngestedAt null for an empty table', async () => {
    const app = appWith(fakeTollPlazaStore());

    const res = await app.inject({ method: 'GET', url: '/admin/toll-plazas-status' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ count: 0, lastIngestedAt: null });
  });

  it('reflects the real count and the most recent ingestedAt across all rows', async () => {
    const older = new Date('2026-08-01T00:00:00.000Z');
    const newer = new Date('2026-09-01T00:00:00.000Z');
    const records = DUTRA_TOLL_PLAZA_RECORDS.map((r, i) => ({
      ...r,
      ingestedAt: i === 0 ? newer : older,
    }));
    const app = appWith(fakeTollPlazaStore(records));

    const res = await app.inject({ method: 'GET', url: '/admin/toll-plazas-status' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      count: DUTRA_TOLL_PLAZA_RECORDS.length,
      lastIngestedAt: newer.toISOString(),
    });
  });

  it('counts inactive rows too — count is every row, not just listActive()', async () => {
    const records = DUTRA_TOLL_PLAZA_RECORDS.map((r, i) => ({ ...r, active: i % 2 === 0 }));
    const app = appWith(fakeTollPlazaStore(records));

    const res = await app.inject({ method: 'GET', url: '/admin/toll-plazas-status' });

    expect(res.json().count).toBe(records.length);
  });

  it('requires no Authorization header (deliberately unauthenticated, same precedent as G1)', async () => {
    const app = appWith(fakeTollPlazaStore(DUTRA_TOLL_PLAZA_RECORDS));

    const res = await app.inject({ method: 'GET', url: '/admin/toll-plazas-status' });

    expect(res.statusCode).toBe(200);
  });
});
