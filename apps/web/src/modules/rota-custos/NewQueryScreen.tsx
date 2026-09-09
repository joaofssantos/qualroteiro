import { ArrowRight, Loader2, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ApiError, planRoute, userMessage } from '@/core/api/client';
import type { PlaceInput, PlanRouteRequest } from '@/core/api/types';
import { PlaceSearch, type PlaceFieldValue } from '@/core/components/PlaceSearch';
import {
  VehicleProfileForm,
  type VehicleProfileValue,
} from '@/core/components/VehicleProfileForm';
import { useRouteStore } from '@/core/store/routeStore';

import { MODULE_PATH } from './module';

/**
 * Tela 1 — nova consulta.
 *
 * Owns the form state locally and only writes to the store once a plan has been
 * requested, so an abandoned half-typed form leaves nothing behind.
 */

const EMPTY_FIELD: PlaceFieldValue = { text: '', place: null };

/** Sensible starting point: a car doing 10 km/l with fuel at R$ 6,00. */
const DEFAULT_VEHICLE: VehicleProfileValue = {
  type: 'car',
  axleCategory: 'car',
  consumptionKmPerL: 10,
  fuelPricePerL: 6,
};

/**
 * Coordinates when the user picked a hit, the raw string otherwise.
 *
 * Both are valid per the contract. Sending the string is what lets the server
 * geocode free text — and what produces the `422` this screen knows how to pin
 * back to the field that caused it.
 */
function toPlaceInput(field: PlaceFieldValue): PlaceInput {
  return field.place ? { lng: field.place.lng, lat: field.place.lat } : field.text.trim();
}

export function NewQueryScreen() {
  const navigate = useNavigate();
  const startPlanning = useRouteStore((s) => s.startPlanning);
  const planSucceeded = useRouteStore((s) => s.planSucceeded);
  const planFailed = useRouteStore((s) => s.planFailed);

  const [origin, setOrigin] = useState<PlaceFieldValue>(EMPTY_FIELD);
  const [destination, setDestination] = useState<PlaceFieldValue>(EMPTY_FIELD);
  const [stops, setStops] = useState<readonly PlaceFieldValue[]>([]);
  const [vehicle, setVehicle] = useState<VehicleProfileValue>(DEFAULT_VEHICLE);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function setStop(index: number, value: PlaceFieldValue): void {
    setStops((current) => current.map((stop, i) => (i === index ? value : stop)));
  }

  async function handleSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();

    // Client-side validation first, so an obviously incomplete form never
    // becomes a request the server has to reject.
    const errors: Record<string, string> = {};
    if (origin.text.trim() === '') errors['origin'] = 'Informe a origem.';
    if (destination.text.trim() === '') errors['destination'] = 'Informe o destino.';
    if (vehicle.consumptionKmPerL <= 0) errors['consumptionKmPerL'] = 'Informe um consumo maior que zero.';
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) return;

    const request: PlanRouteRequest = {
      origin: toPlaceInput(origin),
      destination: toPlaceInput(destination),
      waypoints: stops.filter((stop) => stop.text.trim() !== '').map(toPlaceInput),
      vehicle: {
        type: vehicle.type,
        axleCategory: vehicle.axleCategory,
        consumptionKmPerL: vehicle.consumptionKmPerL,
      },
      fuelPricePerL: vehicle.fuelPricePerL,
    };

    startPlanning({
      ...request,
      originLabel: origin.text.trim(),
      destinationLabel: destination.text.trim(),
    });
    setSubmitting(true);

    try {
      const routes = await planRoute(request);
      planSucceeded(routes);

      if (routes.length === 0) {
        // A 200 with no alternatives is a valid answer, not an error — the user
        // stays here so they can adjust the trip rather than landing on an empty
        // result screen.
        setFormError('Nenhuma rota encontrada para esse trajeto. Revise os endereços.');
        return;
      }
      navigate(`${MODULE_PATH}/resultado`);
    } catch (cause) {
      const error =
        cause instanceof ApiError ? cause : new ApiError('unknown', 0, String(cause));
      planFailed(error);

      // A 422 is an address problem, and the API told us which address. Pin it to
      // that field instead of reporting a form-wide failure the user cannot act on.
      if (error.kind === 'unresolved-place' && error.field) {
        setFieldErrors({ [error.field]: userMessage(error) });
      } else {
        setFormError(userMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-primary md:text-3xl">
          Quanto custa essa viagem?
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Informe o trajeto e o perfil do veículo para ver distância, tempo, pedágios e
          combustível.
        </p>
      </header>

      <form onSubmit={(e) => void handleSubmit(e)} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-lg border border-border bg-card p-5 shadow-sm">
          <PlaceSearch
            id="origin"
            label="Origem"
            placeholder="Cidade, estado ou endereço"
            value={origin}
            onChange={setOrigin}
            error={fieldErrors['origin']}
          />

          {stops.map((stop, index) => (
            <div key={index} className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <PlaceSearch
                  id={`stop-${index}`}
                  label={`Parada ${index + 1}`}
                  placeholder="Cidade, estado ou endereço"
                  value={stop}
                  onChange={(value) => setStop(index, value)}
                  error={fieldErrors[`waypoints[${index}]`]}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remover parada ${index + 1}`}
                onClick={() => setStops((current) => current.filter((_, i) => i !== index))}
              >
                <X />
              </Button>
            </div>
          ))}

          <PlaceSearch
            id="destination"
            label="Destino"
            placeholder="Cidade, estado ou endereço"
            value={destination}
            onChange={setDestination}
            error={fieldErrors['destination']}
          />

          <div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-primary"
              onClick={() => setStops((current) => [...current, EMPTY_FIELD])}
            >
              <Plus /> Adicionar parada
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-sm">
          <VehicleProfileForm
            value={vehicle}
            onChange={setVehicle}
            errors={
              fieldErrors['consumptionKmPerL']
                ? { consumptionKmPerL: fieldErrors['consumptionKmPerL'] }
                : {}
            }
          />
        </div>

        {formError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <div>
          <Button type="submit" variant="accent" size="lg" disabled={submitting}>
            {submitting ? <Loader2 className="animate-spin" /> : null}
            Calcular rota
            {submitting ? null : <ArrowRight />}
          </Button>
        </div>
      </form>
    </div>
  );
}
