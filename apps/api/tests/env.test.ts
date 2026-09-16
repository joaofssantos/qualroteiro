/**
 * Env reading for the composition root. Uses an explicit env object rather than
 * mutating `process.env`, so tests stay order-independent.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_GOOGLE_PLACES_SEARCH_MONTHLY_CAP,
  DEFAULT_ORS_BASE_URL,
  loadDotEnvInto,
  readClerkEnv,
  readGooglePlacesEnv,
  readOrsEnv,
} from '../src/env.js';

describe('readClerkEnv', () => {
  it('reads and trims CLERK_SECRET_KEY', () => {
    expect(readClerkEnv({ CLERK_SECRET_KEY: '  sk_test_fixture  ' })).toEqual({
      secretKey: 'sk_test_fixture',
    });
  });

  it.each([
    ['absent', {}],
    ['empty', { CLERK_SECRET_KEY: '' }],
    ['blank', { CLERK_SECRET_KEY: '   ' }],
  ])('throws at startup when the key is %s', (_label, env) => {
    expect(() => readClerkEnv(env)).toThrow(/CLERK_SECRET_KEY/);
  });

  it('names the variable without quoting its value', () => {
    // The message reaches a log; a partially-set key must not be echoed there.
    const env = { CLERK_SECRET_KEY: '   ' };
    expect(() => readClerkEnv(env)).toThrow(
      expect.objectContaining({ message: expect.not.stringContaining('   ') }) as Error,
    );
  });
});

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

describe('readGooglePlacesEnv', () => {
  it('reads the key and defaults the monthly cap', () => {
    expect(readGooglePlacesEnv({ GOOGLE_PLACES_API_KEY: 'abc123' })).toEqual({
      apiKey: 'abc123',
      searchMonthlyCap: DEFAULT_GOOGLE_PLACES_SEARCH_MONTHLY_CAP,
    });
  });

  it('defaults the cap to 4500 — below Google\'s 5,000 free-tier ceiling', () => {
    expect(DEFAULT_GOOGLE_PLACES_SEARCH_MONTHLY_CAP).toBe(4500);
  });

  it('honours an explicit monthly cap', () => {
    expect(
      readGooglePlacesEnv({
        GOOGLE_PLACES_API_KEY: 'abc',
        GOOGLE_PLACES_SEARCH_MONTHLY_CAP: '100',
      }),
    ).toEqual({ apiKey: 'abc', searchMonthlyCap: 100 });
  });

  it('fails loudly when the key is absent or blank', () => {
    expect(() => readGooglePlacesEnv({})).toThrow(/GOOGLE_PLACES_API_KEY/);
    expect(() => readGooglePlacesEnv({ GOOGLE_PLACES_API_KEY: '   ' })).toThrow(
      /GOOGLE_PLACES_API_KEY/,
    );
  });

  it.each(['0', '-5', 'not-a-number', 'NaN'])(
    'fails loudly when the cap is not a positive number (%s)',
    (cap) => {
      expect(() =>
        readGooglePlacesEnv({ GOOGLE_PLACES_API_KEY: 'abc', GOOGLE_PLACES_SEARCH_MONTHLY_CAP: cap }),
      ).toThrow(/GOOGLE_PLACES_SEARCH_MONTHLY_CAP/);
    },
  );
});

describe('loadDotEnvInto', () => {
  let dir: string | undefined;

  afterEach(() => {
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
    dir = undefined;
  });

  it('loads a .env file into the target env object (server.ts never did this — the server refused to start with a valid key on disk)', () => {
    dir = mkdtempSync(join(tmpdir(), 'qualroteiro-env-'));
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'ORS_API_KEY=from-dotenv-file\nORS_BASE_URL=https://ors.internal\n');

    const target: NodeJS.ProcessEnv = {};
    loadDotEnvInto(target, envPath);

    expect(target['ORS_API_KEY']).toBe('from-dotenv-file');
    expect(target['ORS_BASE_URL']).toBe('https://ors.internal');
    // Round-trips through the real reader too, not just raw string equality.
    expect(readOrsEnv(target)).toEqual({
      apiKey: 'from-dotenv-file',
      baseUrl: 'https://ors.internal',
    });
  });

  it('never overwrites a variable the process already has (real deployments win over a stray file)', () => {
    dir = mkdtempSync(join(tmpdir(), 'qualroteiro-env-'));
    const envPath = join(dir, '.env');
    writeFileSync(envPath, 'ORS_API_KEY=from-dotenv-file\n');

    const target: NodeJS.ProcessEnv = { ORS_API_KEY: 'from-real-deployment-env' };
    loadDotEnvInto(target, envPath);

    expect(target['ORS_API_KEY']).toBe('from-real-deployment-env');
  });

  it('is a silent no-op when the file does not exist (production with no .env)', () => {
    const target: NodeJS.ProcessEnv = {};
    expect(() => loadDotEnvInto(target, '/nonexistent/path/.env')).not.toThrow();
    expect(target).toEqual({});
  });
});
