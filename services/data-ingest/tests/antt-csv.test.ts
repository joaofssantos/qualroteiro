import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { parseAnttTollPlazaCsv } from '../src/antt-csv.js';

const FIXTURE_PATH = fileURLToPath(
  new URL('./fixtures/sample-plazas.csv', import.meta.url),
);

/**
 * `tests/fixtures/sample-plazas.csv` — 4 REAL rows copied verbatim from the
 * live ANTT CSV downloaded on 2026-09-16
 * (`dados.antt.gov.br/dataset/a7e1e12d-f8e8-40cd-bc1f-57973a4a4a6d`, 277
 * active rows, 0 inactive rows) plus 1 SYNTHETIC row
 * ("CONCESSIONARIA TESTE" / "Praça Teste Inativa", `situacao=Inativo`).
 *
 * The synthetic row exists because the real dataset currently has zero
 * inactive rows to sample from — confirmed by parsing the full 277-row file
 * and counting `situacao` values (`{'Ativo': 277}`, no other value present).
 * Simulating one inactive row is what the acceptance criteria asks for in
 * that situation, to prove the inactive-filter actually filters something.
 */
const fixtureCsv = readFileSync(FIXTURE_PATH, 'utf-8');

describe('parseAnttTollPlazaCsv', () => {
  const ingestedAt = new Date('2026-09-16T12:00:00.000Z');

  it('reads all 5 data rows, 4 active + 1 inactive', () => {
    const result = parseAnttTollPlazaCsv(fixtureCsv, ingestedAt);
    expect(result.totalRows).toBe(5);
    expect(result.activeRecords).toHaveLength(4);
    expect(result.errors).toHaveLength(0);
  });

  it('filters out the inactive row (situacao !== "Ativo")', () => {
    const result = parseAnttTollPlazaCsv(fixtureCsv, ingestedAt);
    expect(result.inactiveSkipped).toBe(1);
    expect(result.activeRecords.some((r) => r.name === 'Praça Teste Inativa')).toBe(false);
  });

  it('CRITICAL: maps latitude -> lat and longitude -> lng WITHOUT swapping axes (real "Conselheiro Josino" row)', () => {
    const result = parseAnttTollPlazaCsv(fixtureCsv, ingestedAt);
    const conselheiroJosino = result.activeRecords.find((r) => r.name === 'Conselheiro Josino');

    expect(conselheiroJosino).toBeDefined();
    // Real CSV row: latitude=-21.552594, longitude=-41.331597.
    // Brazil's latitudes are all negative and roughly -34..+5; its
    // longitudes are all negative and roughly -74..-30 — these two values
    // are close enough in magnitude that a swapped-axis bug would NOT be
    // obviously wrong on a map, which is exactly why this needs an exact
    // assertion rather than a "looks plausible" range check.
    expect(conselheiroJosino?.lat).toBe(-21.552594);
    expect(conselheiroJosino?.lng).toBe(-41.331597);
  });

  it('maps every other field correctly for the same row', () => {
    const result = parseAnttTollPlazaCsv(fixtureCsv, ingestedAt);
    const conselheiroJosino = result.activeRecords.find((r) => r.name === 'Conselheiro Josino');

    expect(conselheiroJosino).toMatchObject({
      concessionaire: 'AUTOPISTA FLUMINENSE',
      name: 'Conselheiro Josino',
      highway: 'BR-101',
      uf: 'RJ',
      municipality: 'Campos dos Goytacazes',
      km: 40.5,
      active: true,
    });
    expect(conselheiroJosino?.ingestedAt).toEqual(ingestedAt);
  });

  it('assembles the documented natural-key slug as the id', () => {
    const result = parseAnttTollPlazaCsv(fixtureCsv, ingestedAt);
    const conselheiroJosino = result.activeRecords.find((r) => r.name === 'Conselheiro Josino');
    expect(conselheiroJosino?.id).toBe('autopista-fluminense-conselheiro-josino-br-101-40-5');
  });

  it('strips accents from names/municipality in the mapped record but the id stays ASCII', () => {
    const result = parseAnttTollPlazaCsv(fixtureCsv, ingestedAt);
    const saoGoncalo = result.activeRecords.find((r) => r.highway === 'BR-101' && r.km === 299.69);
    expect(saoGoncalo?.name).toBe('São Gonçalo'); // accent preserved in the display field
    expect(saoGoncalo?.id).toBe('autopista-fluminense-sao-goncalo-br-101-299-69'); // stripped in the id
  });

  it('produces the same ids on a second parse of the same CSV (stable, idempotent natural key)', () => {
    const first = parseAnttTollPlazaCsv(fixtureCsv, ingestedAt);
    const second = parseAnttTollPlazaCsv(fixtureCsv, new Date('2026-10-01T06:00:00.000Z'));

    const firstIds = first.activeRecords.map((r) => r.id).sort();
    const secondIds = second.activeRecords.map((r) => r.id).sort();
    expect(secondIds).toEqual(firstIds);
    expect(new Set(secondIds).size).toBe(secondIds.length); // still unique, no collisions
  });

  it('rejects an unexpected header instead of silently misreading columns', () => {
    const badCsv = 'wrong;header\nfoo;bar';
    const result = parseAnttTollPlazaCsv(badCsv, ingestedAt);
    expect(result.activeRecords).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.reason).toContain('unexpected header');
  });

  it('counts a malformed row as an error without aborting the rest of the file', () => {
    const csv = [
      'concessionaria;praca_de_pedagio;ano_do_pnv_snv;rodovia;uf;km_m;municipal;tipo_de_pista;sentido;situacao;data_da_inativacao;latitude;longitude',
      'CONC;Praça Ruim;2020;BR-1;XX;not-a-number;Cidade;Principal;Crescente;Ativo;;-10.0;-50.0',
      'AUTOPISTA FLUMINENSE;Conselheiro Josino;2019;BR-101;RJ;40.5;Campos dos Goytacazes;Principal;Crescente/Decrescente;Ativo;;-21.552594;-41.331597',
    ].join('\n');

    const result = parseAnttTollPlazaCsv(csv, ingestedAt);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.reason).toContain('unparseable number');
    expect(result.activeRecords).toHaveLength(1);
    expect(result.activeRecords[0]?.name).toBe('Conselheiro Josino');
  });
});
