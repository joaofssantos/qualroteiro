import { create } from 'zustand';

import type { PlaceFieldValue } from '@/core/components/PlaceSearch';
import type { VehicleProfileValue } from '@/core/components/VehicleProfileForm';

export const EMPTY_FIELD: PlaceFieldValue = { text: '', place: null };

/** Ponto de partida: carro a 10 km/l com combustível a R$ 6,00. */
export const DEFAULT_VEHICLE: VehicleProfileValue = {
  type: 'car',
  axleCategory: 'car',
  consumptionKmPerL: 10,
  fuelPricePerL: 6,
};

type Updater<T> = T | ((current: T) => T);

interface RouteDraftState {
  origin: PlaceFieldValue;
  destination: PlaceFieldValue;
  stops: readonly PlaceFieldValue[];
  vehicle: VehicleProfileValue;
  setOrigin(value: PlaceFieldValue): void;
  setDestination(value: PlaceFieldValue): void;
  setStops(value: Updater<readonly PlaceFieldValue[]>): void;
  setVehicle(value: VehicleProfileValue): void;
  reset(): void;
}

const initial = () => ({
  origin: EMPTY_FIELD,
  destination: EMPTY_FIELD,
  stops: [] as readonly PlaceFieldValue[],
  vehicle: DEFAULT_VEHICLE,
});

/**
 * Rascunho do formulário de consulta, acima dos shells: trocar de layout
 * desmonta o formulário, mas origem/destino/paradas/veículo sobrevivem até
 * o envio ou `reset()`.
 */
export const useRouteDraftStore = create<RouteDraftState>((set) => ({
  ...initial(),
  setOrigin: (origin) => set({ origin }),
  setDestination: (destination) => set({ destination }),
  setStops: (value) =>
    set((s) => ({ stops: typeof value === 'function' ? value(s.stops) : value })),
  setVehicle: (vehicle) => set({ vehicle }),
  reset: () => set(initial()),
}));
