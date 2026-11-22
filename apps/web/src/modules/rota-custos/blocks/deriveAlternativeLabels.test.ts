import { describe, expect, it } from 'vitest';

import type { PlannedRoute } from '@/core/api/types';
import { DUTRA_PLAZAS, DUTRA_ROUTE } from '@/test/fixtures';

import { deriveAlternativeLabels } from './deriveAlternativeLabels';

function route(over: {
  durationMin: number;
  toll: number;
  fuel: number;
  plazas?: PlannedRoute['tolls']['plazas'];
  unavailablePlazaIds?: readonly string[];
}): PlannedRoute {
  const plazas = over.plazas ?? (over.toll > 0 ? DUTRA_PLAZAS.slice(0, 1) : []);
  return {
    ...DUTRA_ROUTE,
    durationMin: over.durationMin,
    tolls: {
      plazas,
      total: over.toll,
      ...(over.unavailablePlazaIds ? { unavailablePlazaIds: over.unavailablePlazaIds } : {}),
    },
    fuel: { liters: 1, cost: over.fuel },
  };
}

describe('deriveAlternativeLabels', () => {
  it('rotula mais rápida, mais barata e sem pedágio', () => {
    const labels = deriveAlternativeLabels([
      route({ durationMin: 300, toll: 60, fuel: 200 }),
      route({ durationMin: 400, toll: 10, fuel: 150 }),
      route({ durationMin: 500, toll: 0, fuel: 170 }),
    ]);
    expect(labels).toEqual(['Mais rápida', 'Mais barata', 'Sem pedágio']);
  });

  it('uma só rota vira "Rota recomendada"; lista vazia vira vazia', () => {
    expect(deriveAlternativeLabels([route({ durationMin: 1, toll: 1, fuel: 1 })])).toEqual([
      'Rota recomendada',
    ]);
    expect(deriveAlternativeLabels([])).toEqual([]);
  });

  it('empate fica com a primeira; o restante é "Alternativa N"', () => {
    const labels = deriveAlternativeLabels([
      route({ durationMin: 300, toll: 10, fuel: 100 }),
      route({ durationMin: 300, toll: 10, fuel: 100 }),
      route({ durationMin: 350, toll: 20, fuel: 100 }),
    ]);
    expect(labels).toEqual(['Mais rápida', 'Alternativa 2', 'Alternativa 3']);
  });

  it('tarifa ausente não vira "mais barata" nem "sem pedágio"', () => {
    const labels = deriveAlternativeLabels([
      route({ durationMin: 300, toll: 60, fuel: 200 }),
      route({ durationMin: 400, toll: 0, fuel: 100, unavailablePlazaIds: ['p1'] }),
      route({ durationMin: 500, toll: 30, fuel: 150 }),
    ]);
    expect(labels).toEqual(['Mais rápida', 'Alternativa 2', 'Mais barata']);
  });

  it('sem unavailablePlazaIds na API, usa praças sem tarifa do eixo', () => {
    const tariffless = { ...DUTRA_PLAZAS[0]!, tariffByAxleCategory: undefined };
    const labels = deriveAlternativeLabels(
      [
        route({ durationMin: 300, toll: 60, fuel: 200 }),
        route({ durationMin: 400, toll: 0, fuel: 100, plazas: [tariffless] }),
      ],
      'car',
    );
    expect(labels).toEqual(['Mais rápida', 'Alternativa 2']);
  });
});
