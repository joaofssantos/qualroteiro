/**
 * Fixtures for the module tests.
 *
 * The plazas are the *real* seed from `@qualroteiro/tolls` rather than
 * hand-written objects, so a change to `TollPlaza`'s shape breaks these tests
 * instead of letting the UI drift away from the data it will actually receive.
 * The route figures are the ones named in the acceptance criteria: the SP→RJ
 * Dutra shape, `fuel.cost = distanceKm / 10 * 6`.
 */

import { dutraCorridor } from '@qualroteiro/tolls';

import type { PlannedRoute } from '@/core/api/types';

export const DUTRA_PLAZAS = dutraCorridor.plazas.slice(0, 3);

/** The primary alternative: 429.7 km, R$ 52,90 in tolls, 42.97 L at R$ 6,00. */
export const DUTRA_ROUTE: PlannedRoute = {
  geometry: dutraCorridor.referencePolyline,
  distanceKm: 429.7,
  durationMin: 342.5,
  tolls: { plazas: DUTRA_PLAZAS, total: 52.9 },
  fuel: { liters: 42.97, cost: 257.82 },
  points: { tolls: DUTRA_PLAZAS, fuelStations: [] },
};

/**
 * A second alternative — longer, slower, cheaper in tolls. Every headline number
 * differs from the first so a test asserting "the summary changed" cannot pass by
 * accident.
 */
export const ALTERNATIVE_ROUTE: PlannedRoute = {
  geometry: {
    type: 'LineString',
    coordinates: [
      [-46.6333, -23.5505],
      [-45.2, -22.8],
      [-44.1, -22.6],
      [-43.1729, -22.9068],
    ],
  },
  distanceKm: 512.4,
  durationMin: 431,
  tolls: { plazas: DUTRA_PLAZAS.slice(0, 1), total: 18.4 },
  fuel: { liters: 51.24, cost: 307.44 },
  points: { tolls: DUTRA_PLAZAS.slice(0, 1), fuelStations: [] },
};

export const SAO_PAULO = {
  id: 'sp',
  label: 'São Paulo, SP, Brasil',
  lng: -46.6333,
  lat: -23.5505,
} as const;

export const RIO_DE_JANEIRO = {
  id: 'rio',
  label: 'Rio de Janeiro, RJ, Brasil',
  lng: -43.1729,
  lat: -22.9068,
} as const;
