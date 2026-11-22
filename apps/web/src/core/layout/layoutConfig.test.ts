import { describe, expect, it } from 'vitest';

import { LAYOUT_STORAGE_KEY, buildDefaultLayout, readStoredLayout, resolveLayoutId } from './layoutConfig';

function storageWith(value: string | null): Storage {
  return { getItem: (key: string) => (key === LAYOUT_STORAGE_KEY ? value : null) } as Storage;
}

describe('buildDefaultLayout', () => {
  it.each([
    [undefined, 'a'],
    ['b', 'b'],
    ['a', 'a'],
    ['zzz', 'a'],
    ['', 'a'],
  ])('maps %j to %s', (env, expected) => {
    expect(buildDefaultLayout(env)).toBe(expected);
  });
});

describe('readStoredLayout', () => {
  it('returns a valid stored id', () => {
    expect(readStoredLayout(storageWith('b'))).toBe('b');
  });

  it('returns null for an invalid or missing value', () => {
    expect(readStoredLayout(storageWith('x'))).toBeNull();
    expect(readStoredLayout(storageWith(null))).toBeNull();
  });

  it('returns null when reading throws (Safari private mode)', () => {
    const throwing = {
      getItem: () => {
        throw new Error('SecurityError');
      },
    } as unknown as Storage;
    expect(readStoredLayout(throwing)).toBeNull();
  });
});

describe('resolveLayoutId', () => {
  it('mantém um id registrado e cai no primeiro quando o escolhido foi removido', () => {
    expect(resolveLayoutId('b')).toBe('b');
    expect(resolveLayoutId('b', ['a'])).toBe('a');
    expect(resolveLayoutId('zzz', ['a'])).toBe('a');
  });
});
