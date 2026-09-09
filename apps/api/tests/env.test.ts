/**
 * Env reading for the composition root. Uses an explicit env object rather than
 * mutating `process.env`, so tests stay order-independent.
 */

import { describe, expect, it } from 'vitest';

import { DEFAULT_ORS_BASE_URL, readOrsEnv } from '../src/env.js';

describe('readOrsEnv', () => {
  it('reads the key and defaults the base URL', () => {
    expect(readOrsEnv({ ORS_API_KEY: 'abc123' })).toEqual({
      apiKey: 'abc123',
      baseUrl: DEFAULT_ORS_BASE_URL,
    });
  });

  it('honours an explicit base URL', () => {
    expect(readOrsEnv({ ORS_API_KEY: 'abc', ORS_BASE_URL: 'https://ors.internal' })).toEqual({
      apiKey: 'abc',
      baseUrl: 'https://ors.internal',
    });
  });

  it('fails loudly when the key is absent or blank', () => {
    expect(() => readOrsEnv({})).toThrow(/ORS_API_KEY/);
    expect(() => readOrsEnv({ ORS_API_KEY: '   ' })).toThrow(/ORS_API_KEY/);
  });
});
