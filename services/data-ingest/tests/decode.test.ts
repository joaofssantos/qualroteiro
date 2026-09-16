import { describe, expect, it } from 'vitest';

import { decodeAnttCsvBytes } from '../src/decode.js';

describe('decodeAnttCsvBytes', () => {
  it('decodes real ISO-8859-1 bytes captured from the live ANTT CSV download (2026-09-16), not UTF-8', () => {
    // The exact byte sequence for one real data row
    // ("AUTOPISTA FLUMINENSE;São Gonçalo;2019;BR-101;RJ;299.69;São
    // Gonçalo;Principal;Crescente;Ativo;;-22.774713;-42.9455"), captured via
    // `curl` against the real ANTT URL and inspected byte-by-byte. `ã` is
    // byte 0xE3 (227) and `ç` is byte 0xE7 (231) — ISO-8859-1/Windows-1252
    // code points, NOT the multi-byte UTF-8 sequences those letters would
    // take (0xC3 0xA3 and 0xC3 0xA7). Decoding these bytes as UTF-8 would
    // corrupt them silently instead of throwing — this test is what proves
    // the byte-decoding step in `decode.ts` gets it right.
    const realBytes = Buffer.from([
      65, 85, 84, 79, 80, 73, 83, 84, 65, 32, 70, 76, 85, 77, 73, 78, 69, 78, 83, 69, 59, 83, 227,
      111, 32, 71, 111, 110, 231, 97, 108, 111, 59, 50, 48, 49, 57, 59, 66, 82, 45, 49, 48, 49, 59,
      82, 74, 59, 50, 57, 57, 46, 54, 57, 59, 83, 227, 111, 32, 71, 111, 110, 231, 97, 108, 111, 59,
      80, 114, 105, 110, 99, 105, 112, 97, 108, 59, 67, 114, 101, 115, 99, 101, 110, 116, 101, 59,
      65, 116, 105, 118, 111, 59, 59, 45, 50, 50, 46, 55, 55, 52, 55, 49, 51, 59, 45, 52, 50, 46,
      57, 52, 53, 53,
    ]);

    const decoded = decodeAnttCsvBytes(realBytes);

    expect(decoded).toBe(
      'AUTOPISTA FLUMINENSE;São Gonçalo;2019;BR-101;RJ;299.69;São Gonçalo;Principal;Crescente;Ativo;;-22.774713;-42.9455',
    );
  });

  it('round-trips arbitrary ISO-8859-1 text (encode with latin1, decode with the function under test)', () => {
    const text = 'Alexânia - praça numero 1, 50% ocupacao';
    const bytes = Buffer.from(text, 'latin1');
    expect(decodeAnttCsvBytes(bytes)).toBe(text);
  });
});
