/**
 * CORS allow-list wiring (`corsOrigins` → @fastify/cors).
 */

import { describe, expect, it } from 'vitest';

import { buildApp } from '../src/app.js';
import { fakeGeocodeProvider, fakeRoutingProvider, fakeTollPlazaStore } from './helpers/fakes.js';

function appWith(corsOrigins?: readonly (string | RegExp)[]) {
  return buildApp({
    routing: fakeRoutingProvider(),
    geocode: fakeGeocodeProvider(),
    tollPlazas: fakeTollPlazaStore(),
    ...(corsOrigins ? { corsOrigins } : {}),
  });
}

const get = (app: ReturnType<typeof appWith>, origin: string) =>
  app.inject({ method: 'GET', url: '/health', headers: { origin } });

describe('CORS', () => {
  it('echoes an origin that is on the allow-list, never "*"', async () => {
    const app = appWith(['https://qualroteiro.vercel.app']);
    const res = await get(app, 'https://qualroteiro.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://qualroteiro.vercel.app');
  });

  it('does not grant access to an origin outside the allow-list', async () => {
    const app = appWith(['https://qualroteiro.vercel.app']);
    const res = await get(app, 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepts a Vercel preview through an anchored subdomain pattern', async () => {
    const app = appWith([/^https:\/\/qualroteiro-[a-z0-9-]+\.vercel\.app$/]);
    const res = await get(app, 'https://qualroteiro-pr-61.vercel.app');
    expect(res.headers['access-control-allow-origin']).toBe('https://qualroteiro-pr-61.vercel.app');
  });

  it.each([
    'https://qualroteiro-x.vercel.app.evil.com',
    'https://evil.com/qualroteiro-x.vercel.app',
  ])('does not grant access when an origin only contains a preview hostname: %s', async (origin) => {
    const app = appWith([/^https:\/\/qualroteiro-[a-z0-9-]+\.vercel\.app$/]);
    const res = await get(app, origin);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('stays permissive for local development when nothing is configured', async () => {
    const res = await get(appWith(), 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });
});
