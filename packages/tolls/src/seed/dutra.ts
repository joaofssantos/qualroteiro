/**
 * Seed corridor: São Paulo → Rio de Janeiro via Rodovia Presidente Dutra (BR-116).
 *
 * DEMO DATA. Plaza names, concessionaires, coordinates, corridor kilometres and
 * fares approximate the 2024–2025 real world; they are not an authoritative
 * source and must not be used for billing. See the package README.
 */

import type { Corridor } from '../types.js';
import { tariffTable } from '../tariff.js';

const HIGHWAY = 'BR-116';
const CONCESSIONAIRE = 'CCR RioSP';

export const dutraCorridor: Corridor = {
  id: 'sp-rj-dutra',
  name: 'São Paulo – Rio de Janeiro (Rod. Presidente Dutra)',
  highway: HIGHWAY,
  concessionaires: [CONCESSIONAIRE],

  plazas: [
    {
      id: 'dutra-aruja',
      name: 'Arujá',
      concessionaire: CONCESSIONAIRE,
      highway: HIGHWAY,
      km: 32,
      lat: -23.3967,
      lng: -46.3208,
      tariffByAxleCategory: tariffTable(9.2),
    },
    {
      id: 'dutra-jacarei',
      name: 'Jacareí',
      concessionaire: CONCESSIONAIRE,
      highway: HIGHWAY,
      km: 78,
      lat: -23.265,
      lng: -45.945,
      tariffByAxleCategory: tariffTable(6.8),
    },
    {
      id: 'dutra-moreira-cesar',
      name: 'Moreira César',
      concessionaire: CONCESSIONAIRE,
      highway: HIGHWAY,
      km: 145,
      lat: -22.98,
      lng: -45.56,
      tariffByAxleCategory: tariffTable(5.3),
    },
    {
      id: 'dutra-aparecida',
      name: 'Aparecida',
      concessionaire: CONCESSIONAIRE,
      highway: HIGHWAY,
      km: 178,
      lat: -22.83,
      lng: -45.26,
      tariffByAxleCategory: tariffTable(4.8),
    },
    {
      id: 'dutra-itatiaia',
      name: 'Itatiaia',
      concessionaire: CONCESSIONAIRE,
      highway: HIGHWAY,
      km: 253,
      lat: -22.49,
      lng: -44.56,
      tariffByAxleCategory: tariffTable(11.5),
    },
    {
      id: 'dutra-viuva-graca',
      name: 'Viúva Graça',
      concessionaire: CONCESSIONAIRE,
      highway: HIGHWAY,
      km: 320,
      lat: -22.63,
      lng: -43.9,
      tariffByAxleCategory: tariffTable(15.3),
    },
  ],

  /**
   * Coarse reference trace, São Paulo → Rio de Janeiro.
   *
   * Vertices sit a couple of hundred metres off each plaza rather than exactly
   * on it, so the buffer matching in `matchTolls` is genuinely exercised
   * instead of trivially satisfied by identical coordinates.
   */
  referencePolyline: {
    type: 'LineString',
    coordinates: [
      [-46.6333, -23.5505], // São Paulo (Praça da Sé)
      [-46.3208, -23.3947], // near Arujá
      [-45.945, -23.2668], // near Jacareí
      [-45.56, -22.9785], // near Moreira César
      [-45.26, -22.8322], // near Aparecida
      [-44.56, -22.4881], // near Itatiaia
      [-43.9, -22.6316], // near Viúva Graça
      [-43.1729, -22.9068], // Rio de Janeiro (Centro)
    ],
  },
};
