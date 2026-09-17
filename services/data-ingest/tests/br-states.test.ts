import { describe, expect, it } from 'vitest';

import { ufFromStateName } from '../src/br-states.js';

describe('ufFromStateName', () => {
  it('resolves the real "Minas Gerais" addr:state value observed on the live Barbacena OSM nodes', () => {
    expect(ufFromStateName('Minas Gerais')).toBe('MG');
  });

  it('is case- and accent-insensitive', () => {
    expect(ufFromStateName('minas gerais')).toBe('MG');
    expect(ufFromStateName('MINAS GERAIS')).toBe('MG');
    expect(ufFromStateName('São Paulo')).toBe('SP');
    expect(ufFromStateName('sao paulo')).toBe('SP');
  });

  it('resolves every one of the 27 real state/DF names', () => {
    const names: [string, string][] = [
      ['Acre', 'AC'],
      ['Alagoas', 'AL'],
      ['Amapá', 'AP'],
      ['Amazonas', 'AM'],
      ['Bahia', 'BA'],
      ['Ceará', 'CE'],
      ['Distrito Federal', 'DF'],
      ['Espírito Santo', 'ES'],
      ['Goiás', 'GO'],
      ['Maranhão', 'MA'],
      ['Mato Grosso', 'MT'],
      ['Mato Grosso do Sul', 'MS'],
      ['Minas Gerais', 'MG'],
      ['Pará', 'PA'],
      ['Paraíba', 'PB'],
      ['Paraná', 'PR'],
      ['Pernambuco', 'PE'],
      ['Piauí', 'PI'],
      ['Rio de Janeiro', 'RJ'],
      ['Rio Grande do Norte', 'RN'],
      ['Rio Grande do Sul', 'RS'],
      ['Rondônia', 'RO'],
      ['Roraima', 'RR'],
      ['Santa Catarina', 'SC'],
      ['São Paulo', 'SP'],
      ['Sergipe', 'SE'],
      ['Tocantins', 'TO'],
    ];
    for (const [name, uf] of names) {
      expect(ufFromStateName(name)).toBe(uf);
    }
  });

  it('returns undefined for undefined input, an unrecognized name, or a 2-letter code already', () => {
    expect(ufFromStateName(undefined)).toBeUndefined();
    expect(ufFromStateName('Narnia')).toBeUndefined();
    // Deliberately NOT accepted here: this lookup only ever recognizes the
    // full name it observed in real data — a UF code needs no resolution.
    expect(ufFromStateName('MG')).toBeUndefined();
  });
});
