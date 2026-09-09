/**
 * Seed corridor: São Paulo → Campinas via Rodovia dos Bandeirantes (SP-348).
 *
 * DEMO DATA — approximate, not authoritative, not fit for billing.
 * See the package README.
 */

import type { Corridor } from '../types.js';
import { tariffTable } from '../tariff.js';

const HIGHWAY = 'SP-348';
const CONCESSIONAIRE = 'CCR AutoBAn';

export const bandeirantesCorridor: Corridor = {
  id: 'sp-campinas-bandeirantes',
  name: 'São Paulo – Campinas (Rod. dos Bandeirantes)',
  highway: HIGHWAY,
  concessionaires: [CONCESSIONAIRE],

  plazas: [
    {
      id: 'bandeirantes-caieiras',
      name: 'Caieiras',
      concessionaire: CONCESSIONAIRE,
      highway: HIGHWAY,
      km: 32,
      lat: -23.34,
      lng: -46.79,
      tariffByAxleCategory: tariffTable(11.1),
    },
    {
      id: 'bandeirantes-vinhedo',
      name: 'Vinhedo',
      concessionaire: CONCESSIONAIRE,
      highway: HIGHWAY,
      km: 79,
      lat: -23.01,
      lng: -46.97,
      tariffByAxleCategory: tariffTable(11.1),
    },
  ],

  /** Coarse reference trace, São Paulo → Campinas. */
  referencePolyline: {
    type: 'LineString',
    coordinates: [
      [-46.6333, -23.5505], // São Paulo (Praça da Sé)
      [-46.79, -23.338], // near Caieiras
      [-46.97, -23.0118], // near Vinhedo
      [-47.0608, -22.9099], // Campinas (Centro)
    ],
  },
};
