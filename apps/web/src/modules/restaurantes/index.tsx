import { Utensils } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchNearbyPlaces } from '@/core/api/client';
import type { PlaceResult } from '@/core/api/types';
import { PlaceSearch, type PlaceFieldValue } from '@/core/components/PlaceSearch';
import { useMapStore } from '@/core/map/mapStore';
import type { ModuleDefinition } from '@/core/registry/types';
import { formatCurrency } from '@/lib/format';

import { calculateRestaurantCost, type RestaurantVisit } from './calc';
import { MODULE_PATH } from './module';
import { SaveRestaurantToTripDialog } from './SaveRestaurantToTripDialog';

function parseMoney(value: string): number {
  return Number(value.replace(',', '.'));
}

function RestaurantPanel() {
  const [placeName, setPlaceName] = useState('Restaurante');
  const [address, setAddress] = useState('');
  const [date, setDate] = useState('');
  const [pricePerPerson, setPricePerPerson] = useState('80');
  const [people, setPeople] = useState('2');
  const [reference, setReference] = useState<PlaceFieldValue>({ text: '', place: null });
  const [nearbyPlaces, setNearbyPlaces] = useState<readonly PlaceResult[] | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const setMapLayers = useMapStore((state) => state.setMapLayers);
  const setOnMarkerClick = useMapStore((state) => state.setOnMarkerClick);
  const clearMap = useMapStore((state) => state.clearMap);

  const selectNearbyPlace = useCallback((place: PlaceResult) => {
    setSelectedPlaceId(place.id);
    setPlaceName(place.name);
    setAddress(place.address);
  }, []);

  useEffect(() => {
    const point = reference.place;
    if (point === null) {
      setNearbyPlaces(null);
      setNearbyError(null);
      setNearbyLoading(false);
      return;
    }

    const controller = new AbortController();
    setNearbyLoading(true);
    setNearbyError(null);
    setNearbyPlaces(null);
    setSelectedPlaceId(null);

    searchNearbyPlaces(point.lat, point.lng, 'restaurantes', undefined, controller.signal)
      .then(setNearbyPlaces)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setNearbyError('Não foi possível buscar restaurantes agora. Tente novamente em instantes.');
      })
      .finally(() => setNearbyLoading(false));

    return () => controller.abort();
  }, [reference.place]);

  useEffect(() => {
    if (nearbyPlaces === null) {
      setMapLayers([]);
      setOnMarkerClick(undefined);
      return;
    }

    const places = nearbyPlaces;
    setMapLayers([
      {
        id: 'restaurant-results',
        label: 'Restaurantes encontrados',
        visible: true,
        markers: places.map((place) => ({
          id: place.id,
          lat: place.lat,
          lng: place.lng,
          label: place.name,
          kind: 'restaurant',
        })),
      },
    ]);
    setOnMarkerClick((layerId, markerId) => {
      if (layerId !== 'restaurant-results') return;
      const place = places.find((result) => result.id === markerId);
      if (place !== undefined) selectNearbyPlace(place);
    });
  }, [nearbyPlaces, selectNearbyPlace, setMapLayers, setOnMarkerClick]);

  useEffect(() => () => clearMap(), [clearMap]);

  const visit: RestaurantVisit = useMemo(
    () => ({
      placeName: placeName.trim() || 'Restaurante',
      address: address.trim() || null,
      date: date || null,
      pricePerPerson: parseMoney(pricePerPerson) || 0,
      people: Number.parseInt(people, 10) || 0,
    }),
    [address, date, people, placeName, pricePerPerson],
  );

  const costResult = useMemo(() => {
    try {
      return { cost: calculateRestaurantCost(visit), error: null };
    } catch (cause) {
      return {
        cost: null,
        error: cause instanceof Error ? cause.message : 'Revise os dados do restaurante.',
      };
    }
  }, [visit]);
  const peopleError = visit.people < 1 ? costResult.error : null;

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Restaurantes</h1>
        <p className="text-sm text-muted-foreground">
          Calcule refeições por pessoa e salve o custo no planejamento da viagem.
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Buscar perto de</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <PlaceSearch
                id="restaurant-reference"
                label="Ponto de referência"
                placeholder="Cidade, bairro ou endereço"
                value={reference}
                onChange={setReference}
              />

              {nearbyLoading ? <p className="text-sm text-muted-foreground">Buscando restaurantes…</p> : null}
              {nearbyError ? <p role="alert" className="text-sm text-destructive">{nearbyError}</p> : null}
              {nearbyPlaces !== null && nearbyPlaces.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum restaurante encontrado nessa região.</p>
              ) : null}
              {nearbyPlaces !== null && nearbyPlaces.length > 0 ? (
                <ul aria-label="Restaurantes encontrados" className="grid gap-2">
                  {nearbyPlaces.map((place) => (
                    <li key={place.id}>
                      <button
                        type="button"
                        aria-pressed={selectedPlaceId === place.id}
                        onClick={() => selectNearbyPlace(place)}
                        className="w-full rounded-md border border-border px-3 py-2 text-left hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="block font-medium text-foreground">{place.name}</span>
                        <span className="block text-sm text-muted-foreground">{place.address}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Refeição</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
                <div className="grid gap-1.5">
                  <Label htmlFor="restaurant-place">Nome do lugar</Label>
                  <Input
                    id="restaurant-place"
                    value={placeName}
                    onChange={(event) => setPlaceName(event.target.value)}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="restaurant-address">Endereço</Label>
                  <Input
                    id="restaurant-address"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Opcional"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor="restaurant-date">Data</Label>
                    <Input
                      id="restaurant-date"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="restaurant-price">Preço por pessoa</Label>
                    <Input
                      id="restaurant-price"
                      type="number"
                      min="0"
                      step="0.01"
                      value={pricePerPerson}
                      onChange={(event) => setPricePerPerson(event.target.value)}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <Label htmlFor="restaurant-people">Pessoas</Label>
                    <Input
                      id="restaurant-people"
                      type="number"
                      min="1"
                      step="1"
                      aria-invalid={peopleError ? true : undefined}
                      aria-describedby={peopleError ? 'restaurant-people-error' : undefined}
                      value={people}
                      onChange={(event) => setPeople(event.target.value)}
                    />
                    {peopleError ? (
                      <p id="restaurant-people-error" role="alert" className="text-xs font-medium text-destructive">
                        {peopleError}
                      </p>
                    ) : null}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <aside>
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {costResult.error && !peopleError ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {costResult.error}
                </p>
              ) : null}
              <div className="grid gap-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Lugar</span>
                  <span className="min-w-0 truncate font-medium text-foreground">{visit.placeName}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Pessoas</span>
                  <span className="font-medium text-foreground">{visit.people}</span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-muted-foreground">Preço/pessoa</span>
                  <span className="font-medium text-foreground">{formatCurrency(visit.pricePerPerson)}</span>
                </div>
              </div>

              {costResult.cost ? (
                <div className="rounded-md border border-border bg-secondary/50 p-4">
                  <span className="text-xs font-medium uppercase text-muted-foreground">Total estimado</span>
                  <p className="mt-1 text-3xl font-semibold text-primary">
                    {formatCurrency(costResult.cost!.totalCost)}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {costResult.cost ? (
                  <SaveRestaurantToTripDialog visit={visit} cost={costResult.cost} />
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => setPeople('1')}>
                  1 pessoa
                </Button>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </section>
  );
}

export const restaurantesModule: ModuleDefinition = {
  id: 'restaurantes',
  label: 'Restaurantes',
  icon: Utensils,
  path: MODULE_PATH,
  Panel: RestaurantPanel,
  showMap: true,
};
