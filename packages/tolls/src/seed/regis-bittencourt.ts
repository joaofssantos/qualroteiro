/**
 * Seed corridor: São Paulo → Curitiba via Rodovia Régis Bittencourt (BR-116 sul).
 *
 * DEMO DATA — approximate, not authoritative, not fit for billing.
 * See the package README.
 *
 * Note this corridor crosses a concession boundary: the SP stretch is operated
 * by Arteris Régis Bittencourt, the PR stretch by Arteris Litoral Sul.
 */

import type { Corridor } from '../types.js';
import { tariffTable } from '../tariff.js';

const HIGHWAY = 'BR-116';
const REGIS = 'Arteris Régis Bittencourt';
const LITORAL_SUL = 'Arteris Litoral Sul';

export const regisBittencourtCorridor: Corridor = {
  id: 'sp-curitiba-regis-bittencourt',
  name: 'São Paulo – Curitiba (Rod. Régis Bittencourt)',
  highway: HIGHWAY,
  concessionaires: [REGIS, LITORAL_SUL],

  plazas: [
    {
      id: 'regis-juquitiba',
      name: 'Juquitiba',
      concessionaire: REGIS,
      highway: HIGHWAY,
      km: 58,
      lat: -23.93,
      lng: -47.07,
      tariffByAxleCategory: tariffTable(15.9),
    },
    {
      id: 'regis-miracatu',
      name: 'Miracatu',
      concessionaire: REGIS,
      highway: HIGHWAY,
      km: 118,
      lat: -24.28,
      lng: -47.46,
      tariffByAxleCategory: tariffTable(15.9),
    },
    {
      id: 'regis-registro',
      name: 'Registro',
      concessionaire: REGIS,
      highway: HIGHWAY,
      km: 175,
      lat: -24.49,
      lng: -47.84,
      tariffByAxleCategory: tariffTable(15.9),
    },
    {
      id: 'regis-cajati',
      name: 'Cajati',
      concessionaire: REGIS,
      highway: HIGHWAY,
      km: 218,
      lat: -24.73,
      lng: -48.11,
      tariffByAxleCategory: tariffTable(15.9),
    },
    {
      id: 'regis-barra-do-turvo',
      name: 'Barra do Turvo',
      concessionaire: REGIS,
      highway: HIGHWAY,
      km: 263,
      lat: -24.76,
      lng: -48.5,
      tariffByAxleCategory: tariffTable(15.9),
    },
    {
      id: 'regis-campina-grande-do-sul',
      name: 'Campina Grande do Sul',
      concessionaire: LITORAL_SUL,
      highway: HIGHWAY,
      km: 372,
      lat: -25.3,
      lng: -48.92,
      tariffByAxleCategory: tariffTable(12.6),
    },
  ],

  /** Coarse reference trace, São Paulo → Curitiba. */
  referencePolyline: {
    type: 'LineString',
    coordinates: [
      [-46.6333, -23.5505], // São Paulo (Praça da Sé)
      [-47.07, -23.928], // near Juquitiba
      [-47.46, -24.2818], // near Miracatu
      [-47.84, -24.4885], // near Registro
      [-48.11, -24.7322], // near Cajati
      [-48.5, -24.7581], // near Barra do Turvo
      [-48.92, -25.3016], // near Campina Grande do Sul
      [-49.2733, -25.4284], // Curitiba (Centro)
    ],
  },
};
