import { Ticket } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchNearbyPlaces } from '@/core/api/client';
import { PlaceSearch, type PlaceFieldValue } from '@/core/components/PlaceSearch';
import type { PlaceResult } from '@/core/api/types';
import type { MapLayerData } from '@/core/map/layers';
import { useMapStore } from '@/core/map/mapStore';
import type { ModuleDefinition } from '@/core/registry/types';
import { formatCurrency } from '@/lib/format';

import { calculateActivityCost, type ActivityPlan } from './calc';
import { MODULE_PATH } from './module';
import { SaveActivityToTripDialog } from './SaveActivityToTripDialog';

const DEFAULT_PLAN: ActivityPlan = {
  placeName: 'Passeio de barco',
  address: null,
  date: '2026-10-02',
  pricePerPerson: 150,
  people: 2,
};

const ACTIVITY_LAYER_ID = 'atividade-lugares';
const EMPTY_REFERENCE: PlaceFieldValue = { text: '', place: null };

type SearchState = 'idle' | 'loading' | 'error' | 'empty' | 'results';

function AtividadesPanel() {
  const [placeName, setPlaceName] = useState(DEFAULT_PLAN.placeName);
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(DEFAULT_PLAN.date ?? '');
  const [pricePerPerson, setPricePerPerson] = useState(String(DEFAULT_PLAN.pricePerPerson));
  const [people, setPeople] = useState(String(DEFAULT_PLAN.people));
  const [reference, setReference] = useState<PlaceFieldValue>(EMPTY_REFERENCE);
  const [places, setPlaces] = useState<readonly PlaceResult[]>([]);
  const [searchState, setSearchState] = useState<SearchState>('idle');
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const setMapLayers = useMapStore((state) => state.setMapLayers);
  const setMapTrace = useMapStore((state) => state.setMapTrace);
  const setOnMarkerClick = useMapStore((state) => state.setOnMarkerClick);
  const clearMap = useMapStore((state) => state.clearMap);

  useEffect(() => {
    const point = reference.place;
    if (!point) {
      setPlaces([]);
      setSelectedPlaceId(null);
      setSearchState('idle');
      return;
    }

    const controller = new AbortController();
    setSearchState('loading');
    setPlaces([]);
    setSelectedPlaceId(null);

    searchNearbyPlaces(point.lat, point.lng, 'atividades', undefined, controller.signal)
      .then((results) => {
        setPlaces(results);
        setSearchState(results.length === 0 ? 'empty' : 'results');
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setPlaces([]);
        setSearchState('error');
      });

    return () => controller.abort();
  }, [reference.place]);

  const mapLayers = useMemo<readonly (MapLayerData & { visible: boolean })[]>(
    () => [
      {
        id: ACTIVITY_LAYER_ID,
        label: 'Atividades encontradas',
        visible: true,
        markers: places.map((place) => ({
          id: place.id,
          lng: place.lng,
          lat: place.lat,
          label: place.name,
          kind: 'waypoint' as const,
        })),
      },
    ],
    [places],
  );

  useEffect(() => {
    setMapLayers(mapLayers);
    setMapTrace(null);
  }, [mapLayers, setMapLayers, setMapTrace]);

  const selectPlace = useCallback((place: PlaceResult): void => {
    setSelectedPlaceId(place.id);
    setPlaceName(place.name);
    setAddress(place.address);
  }, []);

  useEffect(() => {
    setOnMarkerClick((layerId, markerId) => {
      if (layerId !== ACTIVITY_LAYER_ID) return;
      const place = places.find((result) => result.id === markerId);
      if (place) selectPlace(place);
    });
  }, [places, selectPlace, setOnMarkerClick]);

  // `MapCanvas` lives in the shell, so this module owns clearing what it published.
  useEffect(() => {
    return () => clearMap();
  }, [clearMap]);

  const plan = useMemo<ActivityPlan>(
    () => ({
      placeName: placeName.trim() || 'Atividade',
      address: address.trim() || null,
      date: date || null,
      pricePerPerson: Number(pricePerPerson),
      people: Number(people),
    }),
    [address, date, people, placeName, pricePerPerson],
  );

  const result = useMemo(() => {
    try {
      return { cost: calculateActivityCost(plan), error: null };
    } catch (cause) {
      return {
        cost: null,
        error: cause instanceof Error ? cause.message : 'Não foi possível calcular a atividade.',
      };
    }
  }, [plan]);
  const peopleError = plan.people < 1 ? result.error : null;

  return (
    <section className="map-panel-content mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Atividades</h1>
        <p className="text-sm text-muted-foreground">
          Calcule o custo total de um passeio ou ingresso para incluir no roteiro.
        </p>
      </header>

      <div className="calculator-main-grid grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card className="activity-search-card lg:col-span-2">
          <CardHeader>
            <CardTitle>Encontrar atividade</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4">
              <PlaceSearch
                id="activity-reference"
                label="Buscar perto de"
                value={reference}
                onChange={setReference}
                placeholder="Cidade, bairro ou endereço"
              />

              {searchState === 'loading' ? (
                <p role="status" className="text-sm text-muted-foreground">
                  Buscando atividades próximas…
                </p>
              ) : null}
              {searchState === 'error' ? (
                <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Não foi possível buscar atividades agora. Você pode preencher os dados manualmente.
                </p>
              ) : null}
              {searchState === 'empty' ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade encontrada nesta região.</p>
              ) : null}
              {searchState === 'results' ? (
                <ul aria-label="Atividades encontradas" className="grid gap-2">
                  {places.map((place) => (
                    <li key={place.id}>
                      <Button
                        type="button"
                        variant={selectedPlaceId === place.id ? 'secondary' : 'outline'}
                        className="h-auto w-full justify-start whitespace-normal px-3 py-2 text-left"
                        onClick={() => selectPlace(place)}
                      >
                        <span className="grid gap-0.5">
                          <span>{place.name}</span>
                          <span className="text-xs font-normal text-muted-foreground">{place.address}</span>
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados da atividade</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
              <div className="grid gap-1.5">
                <Label htmlFor="activity-place">Nome do lugar</Label>
                <Input
                  id="activity-place"
                  value={placeName}
                  onChange={(event) => setPlaceName(event.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="activity-address">Endereço</Label>
                <Input
                  id="activity-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div className="calculator-form-grid grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="activity-date">Data</Label>
                  <Input
                    id="activity-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="activity-price">Preço/pessoa</Label>
                  <Input
                    id="activity-price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={pricePerPerson}
                    onChange={(event) => setPricePerPerson(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="activity-people">Nº de pessoas</Label>
                  <Input
                    id="activity-people"
                    type="number"
                    min="1"
                    step="1"
                    aria-invalid={peopleError ? true : undefined}
                    aria-describedby={peopleError ? 'activity-people-error' : undefined}
                    value={people}
                    onChange={(event) => setPeople(event.target.value)}
                  />
                  {peopleError ? (
                    <p id="activity-people-error" role="alert" className="text-xs font-medium text-destructive">
                      {peopleError}
                    </p>
                  ) : null}
                </div>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {result.error && !peopleError ? (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {result.error}
              </p>
            ) : null}
            {result.cost ? (
              <>
                <Metric label="Total" value={formatCurrency(result.cost.totalCost)} />
                <SaveActivityToTripDialog plan={plan} totalCost={result.cost.totalCost} />
              </>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPlaceName(DEFAULT_PLAN.placeName);
                setAddress('');
                setDate(DEFAULT_PLAN.date ?? '');
                setPricePerPerson(String(DEFAULT_PLAN.pricePerPerson));
                setPeople(String(DEFAULT_PLAN.people));
              }}
            >
              Restaurar exemplo
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

function Metric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-bold text-primary">{value}</p>
    </div>
  );
}

export const atividadesModule: ModuleDefinition = {
  id: 'atividades',
  label: 'Atividades',
  icon: Ticket,
  path: MODULE_PATH,
  Panel: AtividadesPanel,
  showMap: true,
};
