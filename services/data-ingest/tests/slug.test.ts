import { describe, expect, it } from 'vitest';

import { naturalKey, slugify } from '../src/slug.js';

describe('slugify', () => {
  it('lowercases and strips accents', () => {
    expect(slugify('São Gonçalo')).toBe('sao-goncalo');
    expect(slugify('P1 ALEXÂNIA')).toBe('p1-alexania');
  });

  it('collapses non-alphanumeric runs into a single hyphen', () => {
    expect(slugify('BR-101')).toBe('br-101');
    expect(slugify('40.5')).toBe('40-5');
    expect(slugify('Campos dos Goytacazes')).toBe('campos-dos-goytacazes');
  });

  it('trims leading/trailing hyphens', () => {
    expect(slugify('  -Praça-  ')).toBe('praca');
  });

  it('is deterministic (same input -> same output, every call)', () => {
    const input = 'Conselheiro Josino';
    expect(slugify(input)).toBe(slugify(input));
  });
});

describe('naturalKey', () => {
  it('joins slugified fields with a single hyphen', () => {
    expect(naturalKey(['AUTOPISTA FLUMINENSE', 'Conselheiro Josino', 'BR-101', '40.5'])).toBe(
      'autopista-fluminense-conselheiro-josino-br-101-40-5',
    );
  });

  it('drops empty fields instead of producing a double hyphen', () => {
    expect(naturalKey(['AUTOPISTA FLUMINENSE', '', 'BR-101', '40.5'])).toBe(
      'autopista-fluminense-br-101-40-5',
    );
  });

  it('is unique across all 4 real sample rows sharing the same concessionaire+highway', () => {
    const a = naturalKey(['AUTOPISTA FLUMINENSE', 'Conselheiro Josino', 'BR-101', '40.5']);
    const b = naturalKey(['AUTOPISTA FLUMINENSE', 'Serrinha', 'BR-101', '123.07']);
    const c = naturalKey(['AUTOPISTA FLUMINENSE', 'São Gonçalo', 'BR-101', '299.69']);
    expect(new Set([a, b, c]).size).toBe(3);
  });
});
