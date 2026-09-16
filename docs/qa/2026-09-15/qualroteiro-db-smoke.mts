import assert from 'node:assert/strict';
import { PrismaClient } from '/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/apps/api/node_modules/@prisma/client/index.js';
import { buildApp } from '/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/apps/api/src/app.ts';
import { loadDotEnvInto } from '/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/apps/api/src/env.ts';
import { createPrismaTripStore } from '/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/apps/api/src/store/prisma-trips.ts';
import { fakeGeocodeProvider, fakeRoutingProvider } from '/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/apps/api/tests/helpers/fakes.ts';
import { fakeAuthVerifier } from '/Users/joaofsantos/Documents/code/qualroteiro/repos/qualroteiro/apps/api/tests/helpers/trip-fakes.ts';
loadDotEnvInto(process.env);
const db = new PrismaClient();
const app = buildApp({ routing: fakeRoutingProvider(), geocode: fakeGeocodeProvider(), auth: fakeAuthVerifier({ 'qa-token': 'qa-db-smoke' }), trips: createPrismaTripStore(db) });
const headers = { authorization: 'Bearer qa-token' };
let id;
try {
  const created = await app.inject({ method: 'POST', url: '/trips', headers, payload: { title: 'QA banco local' } });
  assert.equal(created.statusCode, 201, created.body);
  id = created.json().id;
  const listed = await app.inject({ method: 'GET', url: '/trips', headers });
  assert.equal(listed.statusCode, 200, listed.body);
  assert.ok(listed.json().trips.some(trip => trip.id === id));
  const deleted = await app.inject({ method: 'DELETE', url: `/trips/${id}`, headers });
  assert.equal(deleted.statusCode, 204, deleted.body);
  console.log('PASS: POST /trips 201, GET /trips 200, DELETE /trips 204; real PostgreSQL, simulated authentication.');
} finally {
  if (id) await db.trip.deleteMany({ where: { id, userId: 'qa-db-smoke' } });
  await app.close();
  await db.$disconnect();
}
