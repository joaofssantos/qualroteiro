import { AXLE_CATEGORIES, type AxleCategory } from '@qualroteiro/tolls';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Segmented } from '@/components/ui/segmented';
import { Select } from '@/components/ui/select';

import type { VehicleProfile } from '../api/types';

/**
 * Vehicle profile + fuel price.
 *
 * The axle categories come from `@qualroteiro/tolls`, not from a list retyped
 * here: they are the same categories the tariff table is keyed by, so adding a
 * category upstream makes it appear in this form, and a category that stopped
 * existing would be a compile error rather than a value the API rejects at
 * runtime.
 */

/** pt-BR names for the tariff classes, with the axle/rodagem convention spelled out. */
const AXLE_LABELS: Record<AxleCategory, string> = {
  motorcycle: 'Motocicleta',
  car: 'Automóvel (2 eixos, rodagem simples)',
  car_with_trailer: 'Automóvel com reboque (3 eixos)',
  truck_2_axle: 'Caminhão leve / ônibus (2 eixos, rodagem dupla)',
  truck_3_axle: 'Caminhão / ônibus (3 eixos)',
  truck_4_axle: 'Caminhão (4 eixos)',
  truck_5_axle: 'Caminhão (5 eixos)',
  truck_6_axle: 'Caminhão (6 eixos)',
};

/**
 * Veículo = perfil de roteamento (`type`) + classe tarifária inicial.
 *
 * Separados de propósito: a classe de pedágio é um conceito de *preço* e o perfil
 * é de *malha viária*; um caminhão de 6 eixos e um de 2 roteiam igual mas pagam
 * pedágios bem diferentes. Escolher o veículo só preenche um ponto de partida —
 * o ajuste fino fica em "Opções de trajeto".
 */
const VEHICLE_PRESETS = [
  { value: 'car', label: 'Carro', type: 'car', axleCategory: 'car' },
  { value: 'motorcycle', label: 'Moto', type: 'motorcycle', axleCategory: 'motorcycle' },
  { value: 'truck', label: 'Caminhão', type: 'truck', axleCategory: 'truck_2_axle' },
  { value: 'trailer', label: 'Reboque', type: 'car', axleCategory: 'car_with_trailer' },
] as const satisfies readonly { value: string; label: string; type: string; axleCategory: AxleCategory }[];

function presetOf(value: { type: string; axleCategory: AxleCategory }): string {
  if (value.type === 'motorcycle') return 'motorcycle';
  if (value.type === 'truck') return 'truck';
  if (value.axleCategory === 'car_with_trailer') return 'trailer';
  return 'car';
}

export interface VehicleProfileValue extends VehicleProfile {
  readonly fuelPricePerL: number;
}

export interface VehicleProfileFormProps {
  value: VehicleProfileValue;
  onChange: (value: VehicleProfileValue) => void;
  /** Field-level messages, keyed by field name. */
  errors?: Partial<Record<keyof VehicleProfileValue, string>>;
}

export function VehicleProfileForm({ value, onChange, errors }: VehicleProfileFormProps) {
  function set<K extends keyof VehicleProfileValue>(key: K, next: VehicleProfileValue[K]): void {
    onChange({ ...value, [key]: next });
  }

  /**
   * Keep the raw string in state as a number, but tolerate the intermediate
   * empty box while the user retypes: `Number('')` is 0, which would silently
   * turn "clear the field and type 12" into a moment of "0 km/l".
   */
  function numberOrZero(raw: string): number {
    if (raw.trim() === '') return 0;
    const parsed = Number(raw.replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return (
    <fieldset className="flex flex-col gap-4">
      <legend className="sr-only">Perfil do veículo</legend>

      <Segmented
        aria-label="Veículo"
        value={presetOf(value)}
        onValueChange={(next) => {
          const preset = VEHICLE_PRESETS.find((p) => p.value === next);
          if (preset) onChange({ ...value, type: preset.type, axleCategory: preset.axleCategory });
        }}
        options={VEHICLE_PRESETS.map(({ value: v, label }) => ({ value: v, label }))}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="consumption">Consumo (km/l)</Label>
          <Input
            id="consumption"
            type="number"
            inputMode="decimal"
            min={0.1}
            step={0.1}
            aria-invalid={errors?.consumptionKmPerL ? true : undefined}
            aria-describedby={errors?.consumptionKmPerL ? 'consumption-error' : undefined}
            value={value.consumptionKmPerL === 0 ? '' : String(value.consumptionKmPerL)}
            onChange={(event) => set('consumptionKmPerL', numberOrZero(event.target.value))}
          />
          {errors?.consumptionKmPerL ? (
            <p id="consumption-error" role="alert" className="text-xs font-medium text-destructive">
              {errors.consumptionKmPerL}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="fuel-price">Preço do combustível (R$/l)</Label>
          <Input
            id="fuel-price"
            type="number"
            inputMode="decimal"
            min={0}
            step={0.01}
            aria-invalid={errors?.fuelPricePerL ? true : undefined}
            aria-describedby={errors?.fuelPricePerL ? 'fuel-price-error' : undefined}
            value={value.fuelPricePerL === 0 ? '' : String(value.fuelPricePerL)}
            onChange={(event) => set('fuelPricePerL', numberOrZero(event.target.value))}
          />
          {errors?.fuelPricePerL ? (
            <p id="fuel-price-error" role="alert" className="text-xs font-medium text-destructive">
              {errors.fuelPricePerL}
            </p>
          ) : null}
        </div>
      </div>

      <Accordion type="single" collapsible>
        <AccordionItem value="route-options" className="border-b-0">
          <AccordionTrigger>Opções de trajeto</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="axle-category">Categoria de pedágio</Label>
              <Select
                id="axle-category"
                value={value.axleCategory}
                onChange={(event) => set('axleCategory', event.target.value as AxleCategory)}
              >
                {AXLE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {AXLE_LABELS[category]}
                  </option>
                ))}
              </Select>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </fieldset>
  );
}

export { AXLE_LABELS };
