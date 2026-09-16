import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ingestTollPlazas, type TollPlazaUpsertClient } from '../src/ingest.js';
import type { TollPlazaRecordInput } from '../src/antt-csv.js';

const fixtureCsv = readFileSync(
  new URL('./fixtures/sample-plazas.csv', import.meta.url),
  'utf-8',
);

/**
 * A tiny in-memory stand-in for `PrismaClient`, faithful to real `upsert`
 * semantics (create if the id is absent, update in place if present) — good
 * enough to prove idempotency at the application-logic level without a real
 * database. The real round-trip against Postgres is covered separately (see
 * the job summary / README for whether that was run in this environment).
 */
interface FakeTollPlazaClient extends TollPlazaUpsertClient {
  readonly rows: Map<string, TollPlazaRecordInput>;
  createCalls: number;
  updateCalls: number;
}

function createFakeTollPlazaClient(): FakeTollPlazaClient {
  const rows = new Map<string, TollPlazaRecordInput>();
  const state = { createCalls: 0, updateCalls: 0 };

  return {
    rows,
    get createCalls() {
      return state.createCalls;
    },
    get updateCalls() {
      return state.updateCalls;
    },
    tollPlazaRecord: {
      async upsert(args) {
        const existing = rows.get(args.where.id);
        if (existing) {
          rows.set(args.where.id, { ...existing, ...args.update });
          state.updateCalls++;
        } else {
          rows.set(args.where.id, args.create);
          state.createCalls++;
        }
        return rows.get(args.where.id);
      },
    },
  };
}

describe('ingestTollPlazas', () => {
  it('upserts every active plaza and reports the inactive one as skipped, not an error', async () => {
    const client = createFakeTollPlazaClient();
    const summary = await ingestTollPlazas(client, {
      csvText: fixtureCsv,
      now: new Date('2026-09-16T12:00:00.000Z'),
    });

    expect(summary.totalRowsRead).toBe(5);
    expect(summary.upserts).toBe(4);
    expect(summary.inactiveSkipped).toBe(1);
    expect(summary.errors).toBe(0);
    expect(client.rows.size).toBe(4);
  });

  it('CRITICAL: the upserted Conselheiro Josino row has lat/lng unswapped', async () => {
    const client = createFakeTollPlazaClient();
    await ingestTollPlazas(client, { csvText: fixtureCsv, now: new Date() });

    const row = client.rows.get('autopista-fluminense-conselheiro-josino-br-101-40-5');
    expect(row).toBeDefined();
    expect(row?.lat).toBe(-21.552594);
    expect(row?.lng).toBe(-41.331597);
  });

  it('is idempotent: running twice with the same CSV does not duplicate rows, only updates them', async () => {
    const client = createFakeTollPlazaClient();

    const first = await ingestTollPlazas(client, {
      csvText: fixtureCsv,
      now: new Date('2026-09-16T12:00:00.000Z'),
    });
    expect(first.upserts).toBe(4);
    expect(client.createCalls).toBe(4);
    expect(client.updateCalls).toBe(0);
    expect(client.rows.size).toBe(4);

    const second = await ingestTollPlazas(client, {
      csvText: fixtureCsv,
      now: new Date('2026-10-01T06:00:00.000Z'),
    });
    expect(second.upserts).toBe(4);
    expect(client.rows.size).toBe(4); // still 4 — no duplicates
    expect(client.createCalls).toBe(4); // no NEW creates on the second pass
    expect(client.updateCalls).toBe(4); // all 4 went through update instead

    // ingestedAt moved forward to the second run's timestamp on every row.
    const row = client.rows.get('autopista-fluminense-conselheiro-josino-br-101-40-5');
    expect(row?.ingestedAt).toEqual(new Date('2026-10-01T06:00:00.000Z'));
    // lat/lng are unchanged by the re-run (same source data).
    expect(row?.lat).toBe(-21.552594);
    expect(row?.lng).toBe(-41.331597);
  });

  it('counts a per-row upsert failure as an error without aborting the run', async () => {
    const client = createFakeTollPlazaClient();
    let calls = 0;
    client.tollPlazaRecord.upsert = async (args) => {
      calls++;
      if (calls === 1) throw new Error('simulated DB error');
      return client.rows.set(args.where.id, args.create);
    };

    const summary = await ingestTollPlazas(client, { csvText: fixtureCsv, now: new Date() });
    expect(summary.errors).toBe(1);
    expect(summary.upserts).toBe(3); // the other 3 active rows still went through
  });
});
