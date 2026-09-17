import { describe, expect, it } from 'vitest';

import { runArtespAudit, type OsmTollPlazaReadClient } from '../src/artesp-audit.js';
import type { ArtespParseResult } from '../src/artesp-pdf.js';

function fakeOsmReadClient(
  rows: readonly {
    id: string;
    concessionaire: string;
    name: string;
    lat: number;
    lng: number;
    tariff: unknown;
  }[],
): OsmTollPlazaReadClient {
  return {
    tollPlazaRecord: {
      async findMany() {
        return rows;
      },
    },
  };
}

const perusRow: ArtespParseResult = {
  rows: [
    {
      id: 'sp-330-perus-026-495',
      concessionaire: 'Concessionária do Sistema Anhanguera-Bandeirantes S.A. - AUTOBAN',
      roadCode: 'SP-330',
      roadName: 'Via Anhanguera',
      plazaName: 'PERUS',
      kmRaw: '026+495',
      km: 26.495,
      tariffPasseio: 13.7,
      tariffComercialPorEixo: 13.7,
    },
    {
      id: 'sp-999-sem-match-000-000',
      concessionaire: 'Concessionária Exemplo',
      roadCode: 'SP-999',
      roadName: 'Rodovia Exemplo',
      plazaName: 'PRAÇA SEM CORRESPONDENTE',
      kmRaw: '000+000',
      km: 0,
      tariffPasseio: 5.0,
      tariffComercialPorEixo: 5.0,
    },
  ],
  excludedCatFormatCount: 11,
};

describe('runArtespAudit', () => {
  it('produces a summary + Markdown report from injected ARTESP rows and a fake read-only Prisma client', async () => {
    const prisma = fakeOsmReadClient([
      {
        id: 'osm-1',
        concessionaire: 'CCR AutoBAn',
        name: 'Pedágio Perus (sentido Sul)',
        lat: -23.4,
        lng: -46.8,
        tariff: { car: 13.7, motorcycle: 0, truck_2_axle: 27.4 },
      },
      {
        id: 'osm-rj-outside-sp',
        concessionaire: 'EcoVias Ponte',
        name: 'Ponte Rio Niterói',
        lat: -22.88,
        lng: -43.1,
        tariff: { car: 6.6 },
      },
    ]);

    const result = await runArtespAudit(prisma, {
      artespParseResult: perusRow,
      now: new Date('2026-09-17T00:00:00Z'),
    });

    expect(result.summary.totalArtespRows).toBe(2);
    expect(result.summary.excludedCatFormatCount).toBe(11);
    expect(result.summary.totalOsmSourceRows).toBe(2);
    expect(result.summary.osmOutsideSpBoundingBox).toBe(1);
    expect(result.summary.matchedCount).toBe(1);
    expect(result.summary.matchedOkCount).toBe(1);
    expect(result.summary.artespUnmatchedCount).toBe(1);

    expect(result.reportMarkdown).toContain('# Auditoria ARTESP x OSM');
    expect(result.reportMarkdown).toContain('PRAÇA SEM CORRESPONDENTE');
    expect(result.reportMarkdown).toContain('Pedágio Perus');
  });

  it('never calls anything but `findMany` on the injected Prisma client (read-only — this job never writes TollPlazaRecord)', async () => {
    let findManyCalls = 0;
    const prisma: OsmTollPlazaReadClient = {
      tollPlazaRecord: {
        async findMany(args) {
          findManyCalls++;
          expect(args.where).toEqual({ source: 'osm' });
          return [];
        },
      },
    };

    await runArtespAudit(prisma, { artespParseResult: perusRow });
    expect(findManyCalls).toBe(1);
  });

  it('classifies a tariff divergence in the summary and lists it under "Praças que divergem"', async () => {
    const prisma = fakeOsmReadClient([
      {
        id: 'osm-1',
        concessionaire: 'CCR AutoBAn',
        name: 'Pedágio Perus (sentido Sul)',
        lat: -23.4,
        lng: -46.8,
        tariff: { car: 20.0 }, // way off from ARTESP's R$13,70
      },
    ]);

    const result = await runArtespAudit(prisma, { artespParseResult: perusRow });

    expect(result.summary.matchedDivergingCount).toBe(1);
    expect(result.summary.matchedOkCount).toBe(0);
    expect(result.reportMarkdown).toContain('diverge');
  });
});
