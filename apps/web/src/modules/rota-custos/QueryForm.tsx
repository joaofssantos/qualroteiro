import { ArrowRight, ArrowUpDown, Loader2, Plus, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { ApiError, planRoute, userMessage } from '@/core/api/client';
import type { PlaceInput, PlanRouteRequest } from '@/core/api/types';
import { PlaceSearch, type PlaceFieldValue } from '@/core/components/PlaceSearch';
import { VehicleProfileForm, type VehicleProfileValue } from '@/core/components/VehicleProfileForm';
import { cn } from '@/lib/utils';
import { type EndpointMarker, useRouteStore } from '@/core/store/routeStore';

import { EMPTY_FIELD, useRouteDraftStore } from './routeDraftStore';


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

function endpointMarkersOf(
  origin: PlaceFieldValue,
  destination: PlaceFieldValue,
  stops: readonly PlaceFieldValue[],
): readonly EndpointMarker[] {
  const markers: EndpointMarker[] = [];
  if (origin.place) {
    markers.push({
      id: 'origin',
      kind: 'origin',
      label: `Origem: ${origin.place.label}`,
      place: origin.place,
    });
  }
  for (const [index, stop] of stops.entries()) {
    if (!stop.place) continue;
    markers.push({
      id: `waypoint-${index}`,
      kind: 'waypoint',
      label: `Parada ${index + 1}: ${stop.place.label}`,
      place: stop.place,
    });
  }
  if (destination.place) {
    markers.push({
      id: 'destination',
      kind: 'destination',
      label: `Destino: ${destination.place.label}`,
      place: destination.place,
    });
  }
  return markers;
}

export interface QueryFormEndpoints {
  readonly origin: PlaceFieldValue;
  readonly destination: PlaceFieldValue;
  readonly stops: readonly PlaceFieldValue[];
  readonly vehicle: VehicleProfileValue;
}

export interface QueryFormProps {
  variant: 'panel' | 'hero';
  onSubmitted(): void;
  onEndpointsChange?(endpoints: QueryFormEndpoints): void;
}

export function QueryForm({ variant, onSubmitted, onEndpointsChange }: QueryFormProps) {
  const startPlanning = useRouteStore((s) => s.startPlanning);
  const planSucceeded = useRouteStore((s) => s.planSucceeded);
  const planFailed = useRouteStore((s) => s.planFailed);
  const setEndpointMarkers = useRouteStore((s) => s.setEndpointMarkers);

  // O rascunho vive acima dos shells (trocar de layout desmonta este formulário).
  const origin = useRouteDraftStore((s) => s.origin);
  const destination = useRouteDraftStore((s) => s.destination);
  const stops = useRouteDraftStore((s) => s.stops);
  const vehicle = useRouteDraftStore((s) => s.vehicle);
  const setOrigin = useRouteDraftStore((s) => s.setOrigin);
  const setDestination = useRouteDraftStore((s) => s.setDestination);
  const setStops = useRouteDraftStore((s) => s.setStops);
  const setVehicle = useRouteDraftStore((s) => s.setVehicle);
  const resetDraft = useRouteDraftStore((s) => s.reset);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function syncEndpointMarkers(
    nextOrigin: PlaceFieldValue,
    nextDestination: PlaceFieldValue,
    nextStops: readonly PlaceFieldValue[],
  ): void {
    setEndpointMarkers(endpointMarkersOf(nextOrigin, nextDestination, nextStops));
  }

  function setOriginField(value: PlaceFieldValue): void {
    setOrigin(value);
    syncEndpointMarkers(value, destination, stops);
  }

  function setDestinationField(value: PlaceFieldValue): void {
    setDestination(value);
    syncEndpointMarkers(origin, value, stops);
  }

  function setStop(index: number, value: PlaceFieldValue): void {
    setStops((current) => {
      const nextStops = current.map((stop, i) => (i === index ? value : stop));
      syncEndpointMarkers(origin, destination, nextStops);
      return nextStops;
    });
  }

  function swapEndpoints(): void {
    setOrigin(destination);
    setDestination(origin);
    syncEndpointMarkers(destination, origin, stops);
  }

  // Avisa quem quiser acompanhar o rascunho (a prévia do traçado, em F9). Dispara
  // também ao montar, para o consumidor partir do rascunho que sobreviveu à troca de layout.
  const onEndpointsChangeRef = useRef(onEndpointsChange);
  onEndpointsChangeRef.current = onEndpointsChange;
  useEffect(() => {
    onEndpointsChangeRef.current?.({ origin, destination, stops, vehicle });
  }, [origin, destination, stops, vehicle]);

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
      resetDraft();
      onSubmitted();
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
    <form
      data-testid="query-form"
      data-variant={variant}
      onSubmit={(e) => void handleSubmit(e)}
      noValidate
      className={cn(
        'flex flex-col gap-6',
        // `variant` só muda a grade: no hero (largura de página) trajeto e veículo lado a lado.
        variant === 'hero' && 'lg:grid lg:grid-cols-2 lg:items-start',
      )}
    >
      <div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Trajeto</h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Inverter origem e destino"
            onClick={swapEndpoints}
          >
            <ArrowUpDown />
          </Button>
        </div>

        {/* Linha do tempo origem → paradas → destino. */}
        <div className="relative flex flex-col gap-4 pl-6">
          <span aria-hidden className="absolute bottom-6 left-[7px] top-8 w-px bg-border" />
          <div className="relative">
            <span aria-hidden className="absolute -left-6 top-9 size-3.5 rounded-full border-2 border-primary bg-card" />
            <PlaceSearch
              id="origin"
              label="Origem"
              placeholder="Cidade ou endereço"
              value={origin}
              onChange={setOriginField}
              error={fieldErrors['origin']}
            />
          </div>

          {stops.map((stop, index) => (
            <div key={index} className="relative flex items-end gap-2">
              <span aria-hidden className="absolute -left-6 top-9 size-3.5 rounded-full border-2 border-muted-foreground bg-card" />
              <div className="min-w-0 flex-1">
                <PlaceSearch
                  id={`stop-${index}`}
                  label={`Parada ${index + 1}`}
                  placeholder="Cidade ou endereço"
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
                onClick={() =>
                  setStops((current) => {
                    const nextStops = current.filter((_, i) => i !== index);
                    syncEndpointMarkers(origin, destination, nextStops);
                    return nextStops;
                  })
                }
              >
                <X />
              </Button>
            </div>
          ))}

          <div className="relative">
            <span aria-hidden className="absolute -left-6 top-9 size-3.5 rounded-full bg-primary" />
            <PlaceSearch
              id="destination"
              label="Destino"
              placeholder="Cidade ou endereço"
              value={destination}
              onChange={setDestinationField}
              error={fieldErrors['destination']}
            />
          </div>
        </div>

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
    );
  }
