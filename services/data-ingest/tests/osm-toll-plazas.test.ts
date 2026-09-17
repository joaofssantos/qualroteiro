import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ingestOsmTollPlazas, type OsmTollPlazaUpsertClient } from '../src/osm-toll-plazas.js';
import type { OsmTollPlazaRecordInput } from '../src/osm-toll-plazas.js';
import type { OverpassNode } from '../src/overpass.js';

/**
 * Real Overpass nodes captured live (2026-09-17, `overpass-api.de`,
 * Brazil-wide `barrier=toll_booth` query — see `overpass.ts`'s doc-comment):
 * a 4-lane "Osasco" cluster and a 2-lane "Barueri" cluster (both real
 * `Ecovias Raposo Castello` plazas ~80m lane-to-lane), a same-operator node
 * (`Itapevi`) ~14km away that must NOT merge with either, one example of
 * each of the four `charge` patterns, a node with no `operator` tag, a node
 * with a `name` tag but no `charge`, and a real `addr:state` pair
 * ("Minas Gerais").
 */
const fixtureNodes = JSON.parse(
  readFileSync(new URL('./fixtures/sample-osm-toll-booths.json', import.meta.url), 'utf-8'),
).elements as OverpassNode[];

/** Same fake-client shape/semantics as `ingest.test.ts`'s `FakeTollPlazaClient`. */
interface FakeOsmTollPlazaClient extends OsmTollPlazaUpsertClient {
  readonly rows: Map<string, OsmTollPlazaRecordInput>;
  createCalls: number;
  updateCalls: number;
}

function createFakeOsmTollPlazaClient(): FakeOsmTollPlazaClient {
  const rows = new Map<string, OsmTollPlazaRecordInput>();
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

describe('ingestOsmTollPlazas', () => {
  it('clusters the real 4-lane Osasco group into one plaza, keyed at the smallest node id', async () => {
    const client = createFakeOsmTollPlazaClient();
    await ingestOsmTollPlazas(client, { nodes: fixtureNodes, now: new Date('2026-09-17T00:00:00Z') });

    // Smallest id among {25937871, 1640685437, 8743095970, 8743095971} is 25937871.
    const row = client.rows.get('osm-25937871');
    expect(row).toBeDefined();
    expect(row?.source).toBe('osm');
    expect(row?.concessionaire).toBe('Ecovias Raposo Castello');
    expect(row?.lat).toBe(-23.5116663);
    expect(row?.lng).toBe(-46.8013414);
  });

  it('does NOT merge the Osasco cluster with the Barueri cluster or the Itapevi booth — same operator, all real, all too far apart (>150m)', async () => {
    const client = createFakeOsmTollPlazaClient();
    const summary = await ingestOsmTollPlazas(client, { nodes: fixtureNodes });

    expect(client.rows.has('osm-25937851')).toBe(true); // Barueri (smallest id of {25937851, 25937853})
    expect(client.rows.has('osm-32551122')).toBe(true); // Itapevi, alone
    // 3 distinct Ecovias Raposo Castello plazas total (Osasco, Barueri, Itapevi).
    const ecoviasRows = [...client.rows.values()].filter(
      (r) => r.concessionaire === 'Ecovias Raposo Castello',
    );
    expect(ecoviasRows).toHaveLength(3);
    expect(summary.clusters).toBeGreaterThanOrEqual(3);
  });

  it('parses tariff for all 4 real charge patterns represented in the fixture, source always "osm"', async () => {
    const client = createFakeOsmTollPlazaClient();
    await ingestOsmTollPlazas(client, { nodes: fixtureNodes });

    // Pattern 1 (Osasco, hgv/axle).
    const osasco = client.rows.get('osm-25937871');
    expect(osasco?.tariff).toEqual({
      motorcycle: 0,
      car: 4.2,
      car_with_trailer: 4.2,
      truck_2_axle: 8.4,
      truck_3_axle: 12.6,
      truck_4_axle: 16.8,
      truck_5_axle: 21,
      truck_6_axle: 25.2,
    });

    // Pattern 2 (Pindamonhangaba, hgv without /axle).
    const pinda = client.rows.get('osm-2191768746');
    expect(pinda?.tariff?.car).toBe(12.7);
    expect(pinda?.tariff?.truck_2_axle).toBe(25.4);

    // Pattern 3 (Jundiaí, hgva/axle).
    const jundiai = client.rows.get('osm-3489599093');
    expect(jundiai?.tariff).toEqual({
      motorcycle: 3.2,
      car: 6.4,
      car_with_trailer: 6.4,
      truck_2_axle: 12.8,
      truck_3_axle: 19.2,
      truck_4_axle: 25.6,
      truck_5_axle: 32,
      truck_6_axle: 38.4,
    });

    // Pattern 4 (Camaçari, Mo-Fr/Sa-Su — only weekday kept).
    const camacari = client.rows.get('osm-321191953');
    expect(camacari?.tariff?.car).toBe(9.8); // Mo-Fr value, not the 14.70 Sa-Su value.
    expect(camacari?.tariff?.motorcycle).toBe(4.9);

    for (const row of [osasco, pinda, jundiai, camacari]) {
      expect(row?.source).toBe('osm');
    }
  });

  it('skips nodes with no operator tag, counted not silently dropped', async () => {
    const client = createFakeOsmTollPlazaClient();
    const summary = await ingestOsmTollPlazas(client, { nodes: fixtureNodes });

    expect(summary.skippedNoOperator).toBe(1); // node 2087431077
    expect([...client.rows.values()].some((r) => r.lat === -22.2414302)).toBe(false);
  });

  it('a node with no charge tag upserts with tariff omitted (not written), counted in tariffMissing, and falls back name -> note -> operator+id', async () => {
    const client = createFakeOsmTollPlazaClient();
    const summary = await ingestOsmTollPlazas(client, { nodes: fixtureNodes });

    const noCharge = client.rows.get('osm-1838413379');
    expect(noCharge?.tariff).toBeUndefined();
    expect(noCharge?.name).toBe('Cobrança de Direiro de Passagem na Terra Indígena Utiariti'); // real `name` tag used
    expect(summary.tariffMissing).toBeGreaterThanOrEqual(1);
  });

  it('falls back to the note tag for name when no name tag is present (the common real case)', async () => {
    const client = createFakeOsmTollPlazaClient();
    await ingestOsmTollPlazas(client, { nodes: fixtureNodes });

    const osasco = client.rows.get('osm-25937871');
    expect(osasco?.name).toBe('Osasco - 1'); // real `note` tag, no `name` tag on this node
  });

  it('resolves uf from the real addr:state="Minas Gerais" tag via br-states.ts, and falls back to the "BR" sentinel otherwise', async () => {
    const client = createFakeOsmTollPlazaClient();
    await ingestOsmTollPlazas(client, { nodes: fixtureNodes });

    const barbacena = client.rows.get('osm-3798361958');
    expect(barbacena?.uf).toBe('MG');
    expect(barbacena?.municipality).toBe('Barbacena');

    const osasco = client.rows.get('osm-25937871'); // no addr:state on this real node
    expect(osasco?.uf).toBe('BR');
    expect(osasco?.municipality).toBe('Não informado (OSM)');
    expect(osasco?.highway).toBe('Não informado (OSM)');
    expect(osasco?.km).toBe(0);
  });

  it('is idempotent: running twice against the same nodes does not duplicate rows, only updates them', async () => {
    const client = createFakeOsmTollPlazaClient();

    const first = await ingestOsmTollPlazas(client, {
      nodes: fixtureNodes,
      now: new Date('2026-09-17T00:00:00Z'),
    });
    const rowCountAfterFirst = client.rows.size;
    expect(first.upserts).toBe(rowCountAfterFirst);
    expect(client.createCalls).toBe(rowCountAfterFirst);
    expect(client.updateCalls).toBe(0);

    const second = await ingestOsmTollPlazas(client, {
      nodes: fixtureNodes,
      now: new Date('2026-10-17T00:00:00Z'),
    });
    expect(client.rows.size).toBe(rowCountAfterFirst); // no new rows
    expect(second.upserts).toBe(rowCountAfterFirst);
    expect(client.createCalls).toBe(rowCountAfterFirst); // unchanged — no new creates
    expect(client.updateCalls).toBe(rowCountAfterFirst); // every row went through update this time

    const osasco = client.rows.get('osm-25937871');
    expect(osasco?.ingestedAt).toEqual(new Date('2026-10-17T00:00:00Z'));
  });

  it('counts a per-cluster upsert failure as an error without aborting the run', async () => {
    const client = createFakeOsmTollPlazaClient();
    let calls = 0;
    client.tollPlazaRecord.upsert = async (args) => {
      calls++;
      if (calls === 1) throw new Error('simulated DB error');
      return client.rows.set(args.where.id, args.create);
    };

    const summary = await ingestOsmTollPlazas(client, { nodes: fixtureNodes });
    expect(summary.errors).toBe(1);
    expect(summary.upserts).toBe(summary.clusters - 1);
  });
});
