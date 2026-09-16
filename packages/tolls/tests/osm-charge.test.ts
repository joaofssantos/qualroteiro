import { describe, expect, it } from 'vitest';

import { parseOsmCharge } from '../src/index.js';

describe('parseOsmCharge', () => {
  it('parses pattern 1 — the real cited example, hgv with an explicit /axle suffix', () => {
    // Real value found via live Overpass query (see orientation.md), one of
    // 503 SP-area toll booths already carrying a `charge` tag.
    const table = parseOsmCharge('14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgv/axle');

    expect(table).not.toBeNull();
    expect(table?.motorcycle).toBe(0);
    expect(table?.car).toBe(14.5);
    expect(table?.car_with_trailer).toBe(14.5);
    expect(table?.truck_2_axle).toBe(29);
    expect(table?.truck_3_axle).toBe(43.5);
    expect(table?.truck_4_axle).toBe(58);
    expect(table?.truck_5_axle).toBe(72.5);
    expect(table?.truck_6_axle).toBe(87);
  });

  it('parses pattern 2 — hgv without the /axle suffix (same per-axle semantics)', () => {
    const table = parseOsmCharge('14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgv');

    expect(table).not.toBeNull();
    expect(table?.car).toBe(14.5);
    expect(table?.truck_2_axle).toBe(29);
    expect(table?.truck_6_axle).toBe(87);
  });

  it('parses pattern 3 — the hgva spelling variant', () => {
    const table = parseOsmCharge('14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgva/axle');

    expect(table).not.toBeNull();
    expect(table?.car).toBe(14.5);
    expect(table?.truck_2_axle).toBe(29);
    expect(table?.truck_6_axle).toBe(87);
  });

  it('parses pattern 4 — Mo-Fr/Sa-Su, using only the Mo-Fr (weekday) value', () => {
    const table = parseOsmCharge(
      'Mo-Fr 14.50BRL/motorcar;Mo-Fr 0.00BRL/motorcycle;Mo-Fr 14.50BRL/hgv/axle;' +
        'Sa-Su 18.00BRL/motorcar;Sa-Su 0.00BRL/motorcycle;Sa-Su 18.00BRL/hgv/axle',
    );

    expect(table).not.toBeNull();
    // Weekday (Mo-Fr) fare, not the higher Sa-Su fare.
    expect(table?.car).toBe(14.5);
    expect(table?.car_with_trailer).toBe(14.5);
    expect(table?.truck_2_axle).toBe(29);
  });

  it('maps motorcar to both car and car_with_trailer with the same value', () => {
    const table = parseOsmCharge('20.00BRL/motorcar;0.00BRL/motorcycle;20.00BRL/hgv/axle');

    expect(table?.car).toBe(table?.car_with_trailer);
  });

  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['a totally unrecognized format', 'free'],
    ['a currency other than BRL', '14.50USD/motorcar;0.00USD/motorcycle;14.50USD/hgv/axle'],
    ['a missing vehicle class (no hgv entry at all)', '14.50BRL/motorcar;0.00BRL/motorcycle'],
    ['an unknown vehicle class', '14.50BRL/motorcar;0.00BRL/motorcycle;14.50BRL/bus/axle'],
    ['a malformed amount', 'abcBRL/motorcar;0.00BRL/motorcycle;14.50BRL/hgv/axle'],
    ['only Sa-Su entries, no Mo-Fr counterpart', 'Sa-Su 18.00BRL/motorcar;Sa-Su 0.00BRL/motorcycle;Sa-Su 18.00BRL/hgv/axle'],
  ])('returns null, never throws, for %s', (_label, chargeTag) => {
    expect(() => parseOsmCharge(chargeTag)).not.toThrow();
    expect(parseOsmCharge(chargeTag)).toBeNull();
  });
});
