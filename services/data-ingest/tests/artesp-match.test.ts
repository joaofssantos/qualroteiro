import { describe, expect, it } from 'vitest';

import {
  isWithinSpBoundingBox,
  matchArtespToOsm,
  normalizePlazaName,
  stringSimilarity,
  type OsmTollPlazaCandidate,
} from '../src/artesp-match.js';
import type { ArtespTollRow } from '../src/artesp-pdf.js';

function artespRow(overrides: Partial<ArtespTollRow>): ArtespTollRow {
  return {
    id: 'test-id',
    concessionaire: 'Concessionária do Sistema Anhanguera-Bandeirantes S.A. - AUTOBAN',
    roadCode: 'SP-330',
    roadName: 'Via Anhanguera',
    plazaName: 'PERUS',
    kmRaw: '026+495',
    km: 26.495,
    tariffPasseio: 13.7,
    tariffComercialPorEixo: 13.7,
    ...overrides,
  };
}

function osmCandidate(overrides: Partial<OsmTollPlazaCandidate>): OsmTollPlazaCandidate {
  return {
    id: 'osm-1',
    concessionaire: 'CCR AutoBAn',
    name: 'Pedágio Perus (sentido Sul)',
    lat: -23.4,
    lng: -46.8,
    tariff: null,
    ...overrides,
  };
}

describe('normalizePlazaName', () => {
  it('strips diacritics, lowercases, and matches ARTESP "PERUS" against OSM\'s real note-tag-derived name', () => {
    expect(normalizePlazaName('PERUS')).toBe('perus');
    expect(normalizePlazaName('Pedágio Perus (sentido Sul)')).toBe('perus');
  });

  it('strips a trailing "*" and lane-number suffix — real ARTESP "CAIEIRAS *" vs real OSM "Pedágio Caieiras (sentido Capital/Sul)"', () => {
    expect(normalizePlazaName('CAIEIRAS *')).toBe('caieiras');
    expect(normalizePlazaName('Pedágio Caieiras (sentido Capital/Sul)')).toBe('caieiras');
  });

  it('strips a real OSM lane-number suffix ("Osasco - 1")', () => {
    expect(normalizePlazaName('Osasco - 1')).toBe('osasco');
  });
});

describe('stringSimilarity', () => {
  it('is 1.0 for identical strings and tolerates a real one-character OSM typo ("Aparecida doTabuado" vs "Aparecida do Tabuado")', () => {
    expect(stringSimilarity('perus', 'perus')).toBe(1);
    const score = stringSimilarity(
      normalizePlazaName('Aparecida doTabuado'),
      normalizePlazaName('Aparecida do Tabuado'),
    );
    expect(score).toBeGreaterThan(0.9);
  });

  it('is low for genuinely unrelated names', () => {
    expect(stringSimilarity(normalizePlazaName('PERUS'), normalizePlazaName('JAGUARIÚNA'))).toBeLessThan(0.4);
  });
});

describe('isWithinSpBoundingBox', () => {
  it('accepts a real São Paulo-area coordinate and rejects a real Rio de Janeiro one (real "Ponte Rio Niterói" OSM row)', () => {
    expect(isWithinSpBoundingBox(-23.5, -46.8)).toBe(true);
    // Real coordinate range for the OSM "EcoVias Ponte" / "Ponte Rio Niterói" row.
    expect(isWithinSpBoundingBox(-22.88, -43.1)).toBe(false);
  });
});

describe('matchArtespToOsm', () => {
  it('matches an ARTESP row against an OSM candidate with a slightly different (but recognizably related) name', () => {
    const artesp = [artespRow({ id: 'artesp-1', plazaName: 'PERUS' })];
    const osm = [osmCandidate({ id: 'osm-1', name: 'Pedágio Perus (sentido Sul)' })];

    const result = matchArtespToOsm(artesp, osm);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.artesp.id).toBe('artesp-1');
    expect(result.matches[0]?.osm.id).toBe('osm-1');
    expect(result.unmatchedArtesp).toHaveLength(0);
    expect(result.unmatchedOsm).toHaveLength(0);
  });

  it('does not force a match for a genuinely unrelated OSM candidate — reports both sides as unmatched', () => {
    const artesp = [artespRow({ id: 'artesp-1', plazaName: 'PERUS' })];
    const osm = [osmCandidate({ id: 'osm-1', name: 'Jaguariúna' })];

    const result = matchArtespToOsm(artesp, osm);

    expect(result.matches).toHaveLength(0);
    expect(result.unmatchedArtesp).toHaveLength(1);
    expect(result.unmatchedOsm).toHaveLength(1);
  });

  it('excludes an OSM candidate outside the São Paulo bounding box before matching, and counts it separately', () => {
    const artesp = [artespRow({ id: 'artesp-1', plazaName: 'PERUS' })];
    const osm = [
      osmCandidate({ id: 'osm-rj', name: 'Ponte Rio Niterói', lat: -22.88, lng: -43.1 }),
    ];

    const result = matchArtespToOsm(artesp, osm);

    expect(result.matches).toHaveLength(0);
    expect(result.osmOutsideSpBoundingBox).toBe(1);
    expect(result.unmatchedOsm).toHaveLength(0); // filtered before the "unmatched" bucket, not counted twice
    expect(result.unmatchedArtesp).toHaveLength(1);
  });

  it('prefers the better of two similarly-named OSM candidates (greedy highest-score-first assignment)', () => {
    const artesp = [artespRow({ id: 'artesp-1', plazaName: 'CAIEIRAS' })];
    const osm = [
      osmCandidate({ id: 'osm-close', name: 'Pedágio Caieiras (sentido Capital/Sul)' }),
      osmCandidate({ id: 'osm-far', name: 'Caieiras Norte Bloqueio Extra' }),
    ];

    const result = matchArtespToOsm(artesp, osm);

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.osm.id).toBe('osm-close');
    expect(result.unmatchedOsm.map((c) => c.id)).toEqual(['osm-far']);
  });

  it('never assigns the same OSM candidate to two different ARTESP rows', () => {
    const artesp = [
      artespRow({ id: 'artesp-1', plazaName: 'PERUS' }),
      artespRow({ id: 'artesp-2', plazaName: 'PERUS' }), // synthetic duplicate name, same section
    ];
    const osm = [osmCandidate({ id: 'osm-1', name: 'Pedágio Perus (sentido Sul)' })];

    const result = matchArtespToOsm(artesp, osm);

    expect(result.matches).toHaveLength(1);
    expect(result.unmatchedArtesp).toHaveLength(1);
  });

  it('gives a small scoring bonus for a shared concessionaire token, without requiring it (soft signal, not a hard filter)', () => {
    // Real-world case: ARTESP's official legal name and OSM's community
    // `operator` tag rarely match verbatim (see this module's doc-comment) —
    // a match must still succeed even with zero shared token, purely on name
    // similarity.
    const artesp = [
      artespRow({
        id: 'artesp-1',
        plazaName: 'PERUS',
        concessionaire: 'Concessionária do Sistema Anhanguera-Bandeirantes S.A. - AUTOBAN',
      }),
    ];
    const osm = [
      osmCandidate({
        id: 'osm-1',
        name: 'Pedágio Perus (sentido Sul)',
        concessionaire: 'Some Unrelated Operator Name',
      }),
    ];

    const result = matchArtespToOsm(artesp, osm);
    expect(result.matches).toHaveLength(1);
  });

  it('respects a custom scoreThreshold', () => {
    const artesp = [artespRow({ id: 'artesp-1', plazaName: 'PERUS' })];
    const osm = [osmCandidate({ id: 'osm-1', name: 'Perus Norte Extra Bloqueio Km118' })];

    const permissive = matchArtespToOsm(artesp, osm, { scoreThreshold: 0.1 });
    expect(permissive.matches).toHaveLength(1);

    const strict = matchArtespToOsm(artesp, osm, { scoreThreshold: 0.95 });
    expect(strict.matches).toHaveLength(0);
  });
});
