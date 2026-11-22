import { describe, expect, it } from 'vitest';

import { reconcileArtespTariffs, resolveArtespTariffs, tariffFromArtesp } from '../src/artesp-reconcile.js';
import { ingestOsmAndReconcileArtesp, type OsmArtespReconcileClient } from '../src/osm-artesp-reconcile.js';
import { ingestOsmTollPlazas } from '../src/osm-toll-plazas.js';
import type { ArtespParseResult, ArtespTollRow } from '../src/artesp-pdf.js';
import type { OsmTollPlazaCandidate } from '../src/artesp-match.js';

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
