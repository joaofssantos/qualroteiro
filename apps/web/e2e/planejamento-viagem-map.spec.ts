import { expect, test } from '@playwright/test';

/**
 * Real-browser evidence for j-20260917-up Wave 3: the trip detail screen's
 * 80/20 map split, one pin per item that has a coordinate (across every day,
 * skipping items that don't), and reopening a saved route with a query onto
 * Tela 2 with the exact figures it was saved with.
 *
 * `TripDetailScreen` is gated on `auth.isSignedIn` (Clerk), and `/trips*`
 * needs a real API. Neither is configured for this workspace, so — same
 * technique used for the F2e/F2f QA pass (see
 * `docs/qa/2026-09-15/qualroteiro-ui-check.mjs` in the workspace root) —
 * the dev-server modules for the auth context are swapped for a signed-in
 * stub and `/api/trips*` is served from a fixture, entirely over
 * `page.route`. Nothing in `apps/web/src` is touched to make this possible.
 */

const TRIP_ID = 'trip-e2e-wave3';

const TOLL_PLAZA = {
  id: 'plaza-1',
  name: 'Praça Dutra 1',
  concessionaire: 'Concessionária Dutra',
  highway: 'BR-116',
  km: 45,
  lat: -23.3,
  lng: -46.0,
  tariffByAxleCategory: { car: 52.9 },
};

/** `PlannedRoute` fields at the payload root — the Wave 1 shape, still valid on its own. */
const ROUTE_FIELDS = {
  geometry: {
    type: 'LineString',
    coordinates: [
      [-46.6333, -23.5505],
      [-43.1729, -22.9068],
    ],
  },
  distanceKm: 429.7,
  durationMin: 342.5,
  tolls: { plazas: [TOLL_PLAZA], total: 52.9 },
  fuel: { liters: 42.97, cost: 257.82 },
  points: { tolls: [TOLL_PLAZA], fuelStations: [] },
};

const SAVED_QUERY = {
  origin: { lng: -46.6333, lat: -23.5505 },
  destination: { lng: -43.1729, lat: -22.9068 },
  waypoints: [],
  vehicle: { type: 'car', axleCategory: 'car', consumptionKmPerL: 10 },
  fuelPricePerL: 6,
  originLabel: 'São Paulo, SP',
  destinationLabel: 'Rio de Janeiro, RJ',
};

const ROUTE_TITLE = 'São Paulo → Rio de Janeiro';

const TRIP_FIXTURE = {
  id: TRIP_ID,
  userId: 'user-qa',
  title: 'Viagem Wave 3 QA',
  startDate: '2026-11-01',
  endDate: '2026-11-02',
  createdAt: '2026-09-17T12:00:00.000Z',
  updatedAt: '2026-09-17T12:00:00.000Z',
  days: [
    {
      id: 'day-1',
      tripId: TRIP_ID,
      date: '2026-11-01',
      order: 0,
      items: [
        {
          id: 'hotel-1',
          tripDayId: 'day-1',
          order: 0,
          moduleId: 'hospedagem',
          kind: 'stay',
          title: 'Hotel Vista Mar',
          payload: {
            placeName: 'Hotel Vista Mar',
            address: 'Av. Atlântica, 100',
            lat: -22.9707,
            lng: -43.1823,
            checkIn: '2026-11-01',
            checkOut: '2026-11-03',
            pricePerNight: 400,
          },
          costEstimate: 800,
        },
        {
          id: 'route-with-query',
          tripDayId: 'day-1',
          order: 1,
          moduleId: 'rota-custos',
          kind: 'route',
          title: ROUTE_TITLE,
          payload: { ...ROUTE_FIELDS, query: SAVED_QUERY },
          costEstimate: 310.72,
        },
        {
          id: 'rest-manual',
          tripDayId: 'day-1',
          order: 2,
          moduleId: 'restaurantes',
          kind: 'meal',
          title: 'Restaurante Manual',
          payload: { lat: null, lng: null, address: 'Rua Desconhecida, 1', people: 2, pricePerPerson: 80 },
          costEstimate: 160,
        },
      ],
    },
    {
      id: 'day-2',
      tripId: TRIP_ID,
      date: '2026-11-02',
      order: 1,
      items: [
        {
          id: 'route-no-query',
          tripDayId: 'day-2',
          order: 0,
          moduleId: 'rota-custos',
          kind: 'route',
          title: 'Rota antiga (pré-Wave 2)',
          // No `query` key at all — exactly what was saved before this journey's Wave 2.
          payload: { ...ROUTE_FIELDS },
          costEstimate: 310.72,
        },
      ],
    },
  ],
};

async function stubSignedIn(page: import('@playwright/test').Page) {
  await page.route('**/src/core/auth/AuthProvider.tsx*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: 'export const AuthProvider = ({ children }) => children; export const AuthActions = () => null;',
    }),
  );
  await page.route('**/src/core/auth/AuthContext.ts*', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: [
        'const auth = { isConfigured: true, isLoaded: true, isSignedIn: true, userName: "QA", getToken: async () => "test-only" };',
        'export const missingAuth = auth;',
        'export const AuthContext = {};',
        'export function useQualAuth() { return auth; }',
      ].join('\n'),
    }),
  );
}

async function stubTripsApi(page: import('@playwright/test').Page) {
  await page.route(
    (url) => /^\/(api\/)?trips(?:\/|$)/.test(url.pathname),
    async (route) => {
      const pathname = new URL(route.request().url()).pathname;
      if (pathname === `/api/trips/${TRIP_ID}` || pathname === `/trips/${TRIP_ID}`) {
        return route.fulfill({ json: TRIP_FIXTURE });
      }
      return route.fulfill({ json: { trips: [{ ...TRIP_FIXTURE, dayCount: 2, itemCount: 4 }] } });
    },
  );
}

test.describe('Planejamento de Viagem — mapa da viagem e reabrir rota (j-20260917-up Wave 3)', () => {
  test('shows the 80/20 split with one pin per item that has a coordinate, and reopening a saved route restores its exact figures', async ({
    page,
  }) => {
    await stubSignedIn(page);
    await stubTripsApi(page);

    await page.goto(`/planejamento-viagem/${TRIP_ID}`);
    await expect(page.getByRole('heading', { name: 'Viagem Wave 3 QA' })).toBeVisible();

    // The 80/20 shell split, same assertions as
    // `AppShell.test.tsx` / decision 0002 use for the other four map modules.
    const main = page.locator('main');
    const mapContainer = page.getByTestId('app-map-container');
    await expect(mapContainer).toHaveClass(/md:w-4\/5/);
    await expect(main).toHaveClass(/md:flex-row/);

    // Exactly 2 markers: Hotel Vista Mar (flat lat/lng) and the route WITH a
    // saved query (geocoded origin). The manually-entered restaurant
    // (lat/lng null) and the route saved before Wave 2 (no query) are left
    // off the map, not errored on.
    const markers = page.locator('.maplibregl-marker');
    await expect(markers).toHaveCount(2, { timeout: 20000 });
    await expect(mapContainer.getByRole('button', { name: 'Hotel Vista Mar' })).toBeVisible();
    await expect(mapContainer.getByRole('button', { name: ROUTE_TITLE })).toBeVisible();

    // The 4th item (no query) is listed normally...
    await expect(page.getByText('Rota antiga (pré-Wave 2)', { exact: true })).toBeVisible();
    // ...but offers no reopen action.
    await expect(page.getByRole('button', { name: /Reabrir rota Rota antiga/i })).toHaveCount(0);

    await page.screenshot({
      path: 'specs/011-viagem-mapa-reabrir-rota/evidence/trip-detail-map-pins.png',
      fullPage: true,
    });

    // Reopen the route that DOES have a saved query.
    await page.getByRole('button', { name: `Reabrir rota ${ROUTE_TITLE}` }).click();

    await expect(page).toHaveURL(/\/rota-custos\/resultado$/);
    await expect(page.getByRole('heading', { name: 'Resultado da rota' })).toBeVisible();

    // Exactly the figures the payload was saved with — a restore, not a
    // recalculation (no `/routes/plan` request was ever made in this test).
    const summary = page.getByTestId('route-summary');
    await expect(summary).toContainText('429,7 km');
    await expect(summary).toContainText('52,90');
    await expect(summary).toContainText('257,82');
    await expect(page.getByText(`${SAVED_QUERY.originLabel} → ${SAVED_QUERY.destinationLabel}`)).toBeVisible();

    await page.screenshot({
      path: 'specs/011-viagem-mapa-reabrir-rota/evidence/route-reopened-resultado.png',
      fullPage: true,
    });
  });

  test('leaves no residual marker when navigating from the trip detail screen to another map module', async ({
    page,
  }) => {
    await stubSignedIn(page);
    await stubTripsApi(page);

    await page.goto(`/planejamento-viagem/${TRIP_ID}`);
    await expect(page.locator('.maplibregl-marker')).toHaveCount(2, { timeout: 20000 });

    await page.getByRole('link', { name: 'Hospedagem' }).click();

    await expect(page.getByRole('heading', { name: 'Hospedagem' })).toBeVisible();
    // Hospedagem's own map starts empty (nothing searched yet) — if the trip
    // screen's cleanup had leaked, its two markers would still be here.
    await expect(page.locator('.maplibregl-marker')).toHaveCount(0);

    await page.screenshot({
      path: 'specs/011-viagem-mapa-reabrir-rota/evidence/no-residual-marker-after-navigating-away.png',
      fullPage: true,
    });
  });
});
