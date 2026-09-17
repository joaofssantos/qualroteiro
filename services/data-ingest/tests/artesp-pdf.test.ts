import { describe, expect, it } from 'vitest';

import { parseArtespTarifaLines } from '../src/artesp-pdf.js';

/**
 * Every fixture line below is copied verbatim (spacing included) from this
 * module's own validated output of `extractArtespPdfLines` against the real
 * ARTESP PDF (2026-09-17 download, 1,257,140 bytes, matching
 * orientation.md's own research) — not hand-typed guesses. Real values used
 * throughout are the ones this journey's spec explicitly cites: Via
 * Anhanguera/Perus R$13,70 and Rodovia dos Bandeirantes/Sumaré R$12,10.
 */
describe('parseArtespTarifaLines', () => {
  it('parses a single-line row in the 2-column format (no Motos) — Via Anhanguera/Perus, R$13,70', () => {
    const lines = [
      'Via Anhanguera                 SP-330   PERUS                        026+495        R$ 13,70               R$ 13,70',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      roadCode: 'SP-330',
      roadName: 'Via Anhanguera',
      plazaName: 'PERUS',
      kmRaw: '026+495',
      km: 26.495,
      tariffPasseio: 13.7,
      tariffComercialPorEixo: 13.7,
    });
    expect(result.rows[0]?.tariffMotos).toBeUndefined();
    expect(result.excludedCatFormatCount).toBe(0);
  });

  it('parses a single-line row in the 3-column format (with Motos) — real Rota das Bandeiras row', () => {
    const lines = [
      'Rodovia Romildo Prado            SP-063    LOUVEIRA                          010+370    R$ 3,90          R$ 3,90        R$ 1,95',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      roadCode: 'SP-063',
      plazaName: 'LOUVEIRA',
      kmRaw: '010+370',
      tariffPasseio: 3.9,
      tariffComercialPorEixo: 3.9,
      tariffMotos: 1.95,
    });
  });

  it('cross-checks Rodovia dos Bandeirantes/Sumaré, R$12,10, alongside sibling rows (no bleed between adjacent single-line rows)', () => {
    const lines = [
      'Rodovia dos Bandeirantes         SP-348   ITUPEVA                       077+430        R$ 13,60               R$ 13,60',
      'Rodovia dos Bandeirantes         SP-348   SUMARÉ                       115+520        R$ 12,10               R$ 12,10',
      'Rodovia dos Bandeirantes         SP-348   LIMEIRA                       159+550        R$ 9,20                 R$ 9,20',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(3);
    const sumare = result.rows.find((row) => row.plazaName === 'SUMARÉ');
    expect(sumare).toMatchObject({
      roadCode: 'SP-348',
      roadName: 'Rodovia dos Bandeirantes',
      tariffPasseio: 12.1,
      tariffComercialPorEixo: 12.1,
    });
  });

  it('joins a road name that wraps across two physical lines onto the following terminal line', () => {
    const lines = [
      'Rodovia Gov. Dr. Adhemar',
      'Pereira de Barros               SP-340   JAGUARIÚNA                   123+500        R$ 17,60               R$ 17,60',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      roadName: 'Rodovia Gov. Dr. Adhemar Pereira de Barros',
      plazaName: 'JAGUARIÚNA',
      tariffPasseio: 17.6,
    });
  });

  it('joins BOTH a road-name AND a plaza-name fragment that wrap together onto one preceding line (real "MORRO DO" / "ALTO (ITAPETININGA)" case)', () => {
    const lines = [
      'Rodovia Antônio Romano                     MORRO DO',
      'Schincariol                     SP-127    ALTO (ITAPETININGA)               133+900        R$ 15,90               R$ 15,90',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      roadName: 'Rodovia Antônio Romano Schincariol',
      plazaName: 'MORRO DO ALTO (ITAPETININGA)',
      tariffPasseio: 15.9,
    });
  });

  it('does NOT graft a complete preceding row onto the next row when both are single-line and share a highway (regression: real "VALINHOS" double-km case)', () => {
    const lines = [
      'Via Anhanguera                 SP-330   VALINHOS                     082+000        R$ 13,60               R$ 13,60',
      'Via Anhanguera                 SP-330   VALINHOS                     081+000        R$ 13,60               R$ 13,60',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(2);
    for (const row of result.rows) {
      // Regression check: `roadName` must be exactly "Via Anhanguera", never
      // "Via Anhanguera Via Anhanguera" (the previous row's own complete
      // highway text wrongly grafted on as a "continuation").
      expect(row.roadName).toBe('Via Anhanguera');
      expect(row.plazaName).toBe('VALINHOS');
    }
    expect(result.rows[0]?.kmRaw).toBe('082+000');
    expect(result.rows[1]?.kmRaw).toBe('081+000');
  });

  it('does not reach into an unrelated following row\'s own leading wrap when this row is already complete (regression: real ESTIVA GERBI / "Rodovia Prof. Boanerges" case)', () => {
    const lines = [
      'Rodovia Dep.Mário Beni          SP-340   ESTIVA GERBI                  192+840        R$ 10,50               R$ 10,50',
      'Rodovia Prof. Boanerges',
      'Nogueira de Lima               SP-340   CASA BRANCA                 221+292        R$ 9,40                 R$ 9,40',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      roadName: 'Rodovia Dep.Mário Beni',
      plazaName: 'ESTIVA GERBI',
    });
    expect(result.rows[1]).toMatchObject({
      roadName: 'Rodovia Prof. Boanerges Nogueira de Lima',
      plazaName: 'CASA BRANCA',
    });
  });

  it('joins a trailing continuation line onto a row whose terminal line carried no plaza name at all (real SPMAR "Trecho Leste" case)', () => {
    const lines = [
      'Rodoanel Mário Covas -                      Praça Leste 1 (Alça de Ligação) /',
      'SP-021                                  88+000         R$ 4,10                 R$ 4,10               R$ 2,05',
      'TRECHO LESTE                           Trecho Leste - Papa João XXIII',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      roadCode: 'SP-021',
      roadName: 'Rodoanel Mário Covas - TRECHO LESTE',
      plazaName: 'Praça Leste 1 (Alça de Ligação) / Trecho Leste - Papa João XXIII',
      kmRaw: '88+000',
      tariffPasseio: 4.1,
      tariffMotos: 2.05,
    });
  });

  it('handles a highway-code quirk with an embedded space ("SP- 065") and a slash-suffixed code ("SPA-086/021")', () => {
    const lines = [
      'Rodovia Dom Pedro I              SP- 065   ATIBAIA                           079+900    R$ 10,60        R$ 10,60        R$ 5,30',
      'Rodoanel Mário Covas -                  PRAÇA 7 - TRECHO SUL / AV.',
      'SPA-086/021                                 0+300          R$ 5,40                 R$ 5,40               R$ 2,70',
      'TRECHO SUL                          PAPA JOÃO XXIII (Mauá)',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.roadCode).toBe('SP- 065');
    expect(result.rows[1]).toMatchObject({
      roadCode: 'SPA-086/021',
      kmRaw: '0+300',
      tariffPasseio: 5.4,
      tariffMotos: 2.7,
    });
  });

  it('tolerates a non-numeric 3rd column value ("Não Aplica") instead of crashing (real Rodoanel Trecho Oeste "PRAÇA 7" row)', () => {
    const lines = [
      'Rodoanel Mário Covas -                PRAÇA 7 - CASTELO BRANCO',
      'SP-021                                  015+610        R$ 3,50                 R$ 3,50             Não Aplica',
      'TRECHO OESTE                       (I) RAMO E',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.tariffMotos).toBeUndefined();
    expect(result.rows[0]).toMatchObject({
      roadCode: 'SP-021',
      kmRaw: '015+610',
      tariffPasseio: 3.5,
      tariffComercialPorEixo: 3.5,
    });
  });

  it('counts CAT-1..9 format rows (excluded from this V1 parser) without producing a row for them', () => {
    const lines = [
      'set/25                 SP 255 - Guatapará (km 045+500)',
      'Multiplicador',
      'Tipo             Sem arredondar              Manual          AVI',
      '1              CAT-1              18,321570                  18,30         17,38',
      '2              CAT-2              36,643139                  36,60         34,77',
      // A real single-line row from a DIFFERENT (simple-format) section,
      // interleaved to confirm the CAT block does not disturb normal parsing.
      'Via Anhanguera                 SP-330   LEME                         181+760        R$ 11,20               R$ 11,20',
      'set/25            SP 255 - Boa Esperança do Sul (km 117+220)',
      'Multiplicador',
      'Tipo             Sem arredondar              Manual           AVI',
      '1              CAT-1              11,990445                  12,00          11,40',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.excludedCatFormatCount).toBe(2);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.plazaName).toBe('LEME');
  });

  it('ignores blank lines between rows', () => {
    const lines = [
      'Via Anhanguera                 SP-330   PIRASSUNUNGA                215+000        R$ 11,20               R$ 11,20',
      '',
      '',
      'Via Anhanguera                 SP-330   LEME                         181+760        R$ 11,20               R$ 11,20',
    ];

    const result = parseArtespTarifaLines(lines);
    expect(result.rows).toHaveLength(2);
  });

  it('best-effort concessionaire capture: non-empty for a section\'s first row, and carries forward unchanged to later rows in the same section', () => {
    // `concessionaire` is explicitly documented as best-effort/display-only
    // (see `ArtespTollRow.concessionaire`'s doc-comment) — this test checks
    // the one property `artesp-audit.ts`'s report actually relies on
    // (something readable, consistently carried across a section), not
    // byte-exact text reconstruction. A concessionaire header's OWN last
    // line can, in some real sections, be mistaken by the (deliberately
    // narrow) pending-line heuristic for a road-name continuation instead —
    // a known limitation of the same shape as the "AUTOBAN" bleed documented
    // in `parseArtespTarifaLines`'s own doc-comment, not covered separately
    // here since it does not affect any load-bearing field (`roadCode`,
    // `kmRaw`, tariffs) or the matching pipeline (`artesp-match.ts` never
    // reads `concessionaire` as a hard filter).
    const lines = [
      'Concessionária de Rodovias do',
      'Interior Paulista S.A. - INTERVIAS',
      'Rodovia Sem Denominação       SP-147   MOGI MIRIM                    052+000        R$ 11,10               R$ 11,10',
      'Rodovia Engº João Tosello        SP-147   LIMEIRA                       091+300        R$ 12,60               R$ 12,60',
    ];

    const result = parseArtespTarifaLines(lines);

    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]?.concessionaire.length).toBeGreaterThan(0);
    // The second row, with no new header text before it, carries the same
    // concessionaire forward rather than resetting to an empty string.
    expect(result.rows[1]?.concessionaire).toBe(result.rows[0]?.concessionaire);
  });
});
