import { describe, expect, it } from 'vitest';

import { reconcileArtespTariffs, resolveArtespTariffs, tariffFromArtesp } from '../src/artesp-reconcile.js';
import { ingestOsmAndReconcileArtesp, type OsmArtespReconcileClient } from '../src/osm-artesp-reconcile.js';
import { ingestOsmTollPlazas } from '../src/osm-toll-plazas.js';
import type { ArtespParseResult, ArtespTollRow } from '../src/artesp-pdf.js';
import type { OsmTollPlazaCandidate } from '../src/artesp-match.js';
import { ARTESP_FREE_FLOW_RECORDS } from '../src/artesp-free-flow.js';
import { ARTESP_AUDIT_OVERRIDE_ROWS } from './fixtures/artesp-audit-overrides.js';

const tariff = { motorcycle: 1, car: 2, car_with_trailer: 2, truck_2_axle: 4, truck_3_axle: 6, truck_4_axle: 8, truck_5_axle: 10, truck_6_axle: 12 } as const;

function row(index: number, roadCode: string, plazaName: string, tariffPasseio = 5, tariffMotos: number | undefined = 2.5): ArtespTollRow {
  return { id: `artesp-${index}`, concessionaire: 'ARTESP', roadCode, roadName: 'Rodovia', plazaName, kmRaw: '001+000', km: 1, tariffPasseio, tariffComercialPorEixo: tariffPasseio, tariffMotos };
}

const freeFlow = [
  ['SP-340', 'Pórtico Santo Antônio de Posse'], ['SP-332', 'Pórtico Engº Coelho (PaP)'],
  ['SP-332', 'Paulínia Jd. Betel (PaP)'], ['SP-075', 'Pórtico Bloqueio Indaiatuba (PaP)'],
  ['SP-075', 'Pórtico Itu 1 (PaP)'], ['SP-021', 'PRAÇA 2 - TRECHO SUL / IMIGRANTES (Pista Externa)'],
  ['SP-021', 'PRAÇA 3 - TRECHO SUL / IMIGRANTES (Pista Externa)'], ['SP-360', 'Pórtico Jundiaí (PaP)'],
] as const;

describe('ARTESP tariff reconciliation', () => {
  it('keeps the ARTESP override after a later OSM ingestion', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const client: OsmArtespReconcileClient = {
      tollPlazaRecord: {
        async upsert({ where, create, update }) {
          rows.set(where.id, { ...(rows.get(where.id) ?? create), ...(rows.has(where.id) ? update : {}) });
        },
        async findMany() {
          return [...rows.values()].map((record) => ({
            id: record.id as string, concessionaire: record.concessionaire as string,
            name: record.name as string, lat: record.lat as number, lng: record.lng as number,
            tariff: record.tariff,
          }));
        },
        async update({ where, data }) {
          rows.set(where.id, { ...rows.get(where.id), ...data });
        },
      },
    };
    const nodes = [{
      type: 'node' as const, id: 191, lat: -22.4, lon: -47.5,
      tags: { operator: 'ARTESP', name: 'RIO CLARO', charge: '11.60BRL/motorcar;0.00BRL/motorcycle;11.60BRL/hgv/axle' },
    }];
    const artespParseResult: ArtespParseResult = {
      rows: [{
        id: 'artesp-rio-claro', concessionaire: 'ARTESP', roadCode: 'SP-191', roadName: 'Rodovia',
        plazaName: 'RIO CLARO', kmRaw: '001+000', km: 1, tariffPasseio: 5, tariffComercialPorEixo: 5,
      }], excludedCatFormatCount: 0,
    };

    await ingestOsmTollPlazas(client, { nodes });
    expect(rows.get('osm-191')?.tariff).toMatchObject({ car: 11.6, motorcycle: 0 });

    await reconcileArtespTariffs(client, { artespParseResult });
    expect(rows.get('osm-191')?.tariff).toMatchObject({ car: 5, motorcycle: 0 });

    // The production OSM entrypoints use this combined path after every later
    // OSM upsert, so its ARTESP pass must restore the earlier override.
    await ingestOsmAndReconcileArtesp(client, { osm: { nodes }, artesp: { artespParseResult } });
    expect(rows.get('osm-191')?.tariff).toMatchObject({ car: 5, motorcycle: 0 });
  });

  it('classifies all 20 audited divergences: 12 official-tariff overrides and 8 Free Flow false matches', () => {
    const conventional = [
      ['SP-191', 'RIO CLARO'], ['SP-340', 'JAGUARIÚNA'], ['SP-340', 'ESTIVA GERBI'], ['SP-340', 'CASA BRANCA'],
      ['SP-350', 'ITOBI'], ['SP-127', 'RIO CLARO'], ['SP-127', 'RIO DAS PEDRAS'], ['SP-150', 'RIACHO GRANDE'],
      ['SP-160', 'PIRATININGA'], ['SP-332', 'ENGENHEIRO COELHO'], ['SP-308', 'RIO DAS PEDRAS'], ['SP-342', 'ESP. SANTO DO PINHAL'],
    ] as const;
    const rows = [...conventional, ...freeFlow].map(([roadCode, plazaName], index) => row(index, roadCode, plazaName));
    const parsed: ArtespParseResult = { rows, excludedCatFormatCount: 0 };
    const osm: OsmTollPlazaCandidate[] = rows.map((artesp, index) => ({ id: `osm-${index}`, concessionaire: 'ARTESP', name: artesp.plazaName, lat: -23, lng: -46, tariff }));

    const resolutions = resolveArtespTariffs(parsed, osm);
    expect(resolutions).toHaveLength(20);
    expect(resolutions.filter((r) => r.cause === 'artesp-precedence')).toHaveLength(12);
    expect(resolutions.filter((r) => r.cause === 'free-flow-wrong-osm-match')).toHaveLength(8);
  });

  it('uses audited ARTESP fares for car and axle-derived trucks, preserving motos when ARTESP omits them', () => {
    const rioClaro = { ...row(0, 'SP-191', 'RIO CLARO', 5), tariffMotos: undefined };
    expect(tariffFromArtesp(rioClaro, tariff)).toEqual({
      motorcycle: 1, car: 5, car_with_trailer: 5, truck_2_axle: 10, truck_3_axle: 15, truck_4_axle: 20, truck_5_axle: 25, truck_6_axle: 30,
    });
    expect(tariffFromArtesp(row(1, 'SP-340', 'JAGUARIÚNA', 17.6, undefined), tariff).car).toBe(17.6);
    expect(tariffFromArtesp(row(2, 'SP-332', 'ENGENHEIRO COELHO', 9.2, 4.6), tariff).motorcycle).toBe(4.6);
  });

  it('persists the twelve final official car values from the audit-table fixture', async () => {
    const parsedRows = ARTESP_AUDIT_OVERRIDE_ROWS.map(([roadCode, plazaName, car], index) => row(index, roadCode, plazaName, car));
    const writes: Array<{ id: string; car: number | undefined }> = [];
    await reconcileArtespTariffs({ tollPlazaRecord: {
      async findMany() { return parsedRows.map((artesp, index) => ({ id: `osm-${index}`, concessionaire: 'ARTESP', name: artesp.plazaName, lat: -23, lng: -46, tariff })); },
      async update({ where, data }) { writes.push({ id: where.id, car: data.tariff.car }); }, async upsert() {},
    } }, { artespParseResult: { rows: parsedRows, excludedCatFormatCount: 0 } });
    expect(writes).toEqual(ARTESP_AUDIT_OVERRIDE_ROWS.map(([, , car], index) => ({ id: `osm-${index}`, car })));
  });

  it('upserts all eight Free Flow records with exact published values and active state', async () => {
    const upserts: Array<{ where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> }> = [];
    await reconcileArtespTariffs({ tollPlazaRecord: {
      async findMany() { return []; }, async update() {}, async upsert(args) { upserts.push(args); },
    } }, { artespParseResult: { rows: [], excludedCatFormatCount: 0 }, now: new Date('2026-11-22T00:00:00Z') });
    expect(upserts).toHaveLength(8);
    expect(upserts.map(({ where, create }) => ({ id: where.id, active: create.active, source: create.source, tariff: create.tariff }))).toEqual([
      { id: 'artesp-free-flow-sp-340-santo-antonio-posse', active: true, source: 'artesp', tariff: { car: 8.8, car_with_trailer: 8.8, truck_2_axle: 17.6, truck_3_axle: 26.4, truck_4_axle: 35.2, truck_5_axle: 44, truck_6_axle: 52.8 } },
      { id: 'artesp-free-flow-sp-332-engenheiro-coelho', active: true, source: 'artesp', tariff: { motorcycle: 3.95, car: 7.9, car_with_trailer: 7.9, truck_2_axle: 15.8, truck_3_axle: 23.7, truck_4_axle: 31.6, truck_5_axle: 39.5, truck_6_axle: 47.4 } },
      { id: 'artesp-free-flow-sp-332-paulinia-betel', active: true, source: 'artesp', tariff: { motorcycle: 2.75, car: 5.5, car_with_trailer: 5.5, truck_2_axle: 11, truck_3_axle: 16.5, truck_4_axle: 22, truck_5_axle: 27.5, truck_6_axle: 33 } },
      { id: 'artesp-free-flow-sp-075-indaiatuba', active: true, source: 'artesp', tariff: { car: 3.5, car_with_trailer: 3.5, truck_2_axle: 7, truck_3_axle: 10.5, truck_4_axle: 14, truck_5_axle: 17.5, truck_6_axle: 21 } },
      { id: 'artesp-free-flow-sp-075-itu-1', active: true, source: 'artesp', tariff: { car: 4.3, car_with_trailer: 4.3, truck_2_axle: 8.6, truck_3_axle: 12.9, truck_4_axle: 17.2, truck_5_axle: 21.5, truck_6_axle: 25.8 } },
      { id: 'artesp-free-flow-sp-360-jundiai', active: true, source: 'artesp', tariff: { motorcycle: 1.15, car: 2.3, car_with_trailer: 2.3, truck_2_axle: 4.6, truck_3_axle: 6.9, truck_4_axle: 9.2, truck_5_axle: 11.5, truck_6_axle: 13.8 } },
      { id: 'artesp-free-flow-sp-021-imigrantes-2', active: true, source: 'artesp', tariff: { motorcycle: 2.7, car: 5.4, car_with_trailer: 5.4, truck_2_axle: 10.8, truck_3_axle: 16.2, truck_4_axle: 21.6, truck_5_axle: 27, truck_6_axle: 32.4 } },
      { id: 'artesp-free-flow-sp-021-imigrantes-3', active: true, source: 'artesp', tariff: { motorcycle: 2.7, car: 5.4, car_with_trailer: 5.4, truck_2_axle: 10.8, truck_3_axle: 16.2, truck_4_axle: 21.6, truck_5_axle: 27, truck_6_axle: 32.4 } },
    ]);
    expect(upserts.every(({ update }) => update.active === true)).toBe(true);
  });

  it('writes the Free Flow constants before a PDF download failure', async () => {
    const upserts: string[] = [];
    await expect(reconcileArtespTariffs({ tollPlazaRecord: {
      async findMany() { return []; }, async update() {}, async upsert({ where }) { upserts.push(where.id); },
    } }, { fetchImpl: (async () => { throw new Error('PDF unavailable'); }) as typeof fetch })).rejects.toThrow('PDF unavailable');
    expect(upserts).toEqual(ARTESP_FREE_FLOW_RECORDS.map(({ id }) => id));
  });

  it('persists only the 12 conventional matches; the eight Free Flow false matches are never overwritten', async () => {
    const rows = [...freeFlow, ['SP-191', 'RIO CLARO'] as const].map(([roadCode, plazaName], index) => row(index, roadCode, plazaName));
    const updates: string[] = [];
    const summary = await reconcileArtespTariffs({ tollPlazaRecord: {
      async findMany() { return rows.map((artesp, index) => ({ id: `osm-${index}`, concessionaire: 'ARTESP', name: artesp.plazaName, lat: -23, lng: -46, tariff })); },
      async update({ where }) { updates.push(where.id); },
      async upsert() {},
    } }, { artespParseResult: { rows, excludedCatFormatCount: 0 }, now: new Date('2026-11-22T00:00:00Z') });
    expect(summary).toMatchObject({ matched: 9, overridden: 1, excludedFreeFlow: 8, skippedMissingOsmTariff: 0, freeFlowUpserts: 8 });
    expect(updates).toEqual(['osm-8']);
  });
});
