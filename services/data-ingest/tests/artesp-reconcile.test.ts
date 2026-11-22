import { describe, expect, it } from 'vitest';

import { reconcileArtespTariffs, resolveArtespTariffs, tariffFromArtesp } from '../src/artesp-reconcile.js';
import type { ArtespParseResult, ArtespTollRow } from '../src/artesp-pdf.js';
import type { OsmTollPlazaCandidate } from '../src/artesp-match.js';

const tariff = { motorcycle: 1, car: 2, car_with_trailer: 2, truck_2_axle: 4, truck_3_axle: 6, truck_4_axle: 8, truck_5_axle: 10, truck_6_axle: 12 } as const;

function row(index: number, roadCode: string, plazaName: string): ArtespTollRow {
  return { id: `artesp-${index}`, concessionaire: 'ARTESP', roadCode, roadName: 'Rodovia', plazaName, kmRaw: '001+000', km: 1, tariffPasseio: 10 + index, tariffComercialPorEixo: 10 + index, tariffMotos: (10 + index) / 2 };
}

const freeFlow = [
  ['SP-340', 'Pórtico Santo Antônio de Posse'], ['SP-332', 'Pórtico Engº Coelho (PaP)'],
  ['SP-332', 'Paulínia Jd. Betel (PaP)'], ['SP-075', 'Pórtico Bloqueio Indaiatuba (PaP)'],
  ['SP-075', 'Pórtico Itu 1 (PaP)'], ['SP-021', 'PRAÇA 2 - TRECHO SUL / IMIGRANTES (Pista Externa)'],
  ['SP-021', 'PRAÇA 3 - TRECHO SUL / IMIGRANTES (Pista Externa)'], ['SP-360', 'Pórtico Jundiaí (PaP)'],
] as const;

describe('ARTESP tariff reconciliation', () => {
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

  it('uses ARTESP for car, axle-derived trucks and declared motorcycle fares', () => {
    expect(tariffFromArtesp(row(0, 'SP-191', 'RIO CLARO'), tariff)).toEqual({
      motorcycle: 5, car: 10, car_with_trailer: 10, truck_2_axle: 20, truck_3_axle: 30, truck_4_axle: 40, truck_5_axle: 50, truck_6_axle: 60,
    });
  });

  it('persists only the 12 conventional matches; the eight Free Flow false matches are never overwritten', async () => {
    const rows = [...freeFlow, ['SP-191', 'RIO CLARO'] as const].map(([roadCode, plazaName], index) => row(index, roadCode, plazaName));
    const updates: string[] = [];
    const summary = await reconcileArtespTariffs({ tollPlazaRecord: {
      async findMany() { return rows.map((artesp, index) => ({ id: `osm-${index}`, concessionaire: 'ARTESP', name: artesp.plazaName, lat: -23, lng: -46, tariff })); },
      async update({ where }) { updates.push(where.id); },
    } }, { artespParseResult: { rows, excludedCatFormatCount: 0 }, now: new Date('2026-11-22T00:00:00Z') });
    expect(summary).toMatchObject({ matched: 9, overridden: 1, excludedFreeFlow: 8, skippedMissingOsmTariff: 0 });
    expect(updates).toEqual(['osm-8']);
  });
});
