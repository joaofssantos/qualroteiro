import { Hotel, Loader2, MapPin } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { searchNearbyPlaces } from '@/core/api/client';
import type { PlaceResult } from '@/core/api/types';
import { PlaceSearch, type PlaceFieldValue } from '@/core/components/PlaceSearch';
import type { MapLayerData } from '@/core/map/layers';
import { useMapStore } from '@/core/map/mapStore';
import type { ModuleDefinition } from '@/core/registry/types';
import { formatCurrency } from '@/lib/format';

import { calculateLodgingCost, type LodgingStay } from './calc';
import { MODULE_PATH } from './module';
import { SaveStayToTripDialog } from './SaveStayToTripDialog';

const DEFAULT_STAY: LodgingStay = {
  placeName: 'Hotel Atlântico',
  address: null,
  lat: null,
  lng: null,
  checkIn: '2026-10-01',
  checkOut: '2026-10-03',
  pricePerNight: 320,
};

const LODGING_LAYER_ID = 'lodging-places';
const EMPTY_REFERENCE: PlaceFieldValue = { text: '', place: null };

function HospedagemPanel() {
  const [placeName, setPlaceName] = useState(DEFAULT_STAY.placeName);
  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ readonly lat: number; readonly lng: number } | null>(null);
  const [checkIn, setCheckIn] = useState(DEFAULT_STAY.checkIn);
  const [checkOut, setCheckOut] = useState(DEFAULT_STAY.checkOut);
  const [pricePerNight, setPricePerNight] = useState(String(DEFAULT_STAY.pricePerNight));
  const [reference, setReference] = useState<PlaceFieldValue>(EMPTY_REFERENCE);
  const [nearbyPlaces, setNearbyPlaces] = useState<readonly PlaceResult[] | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [searchingNearby, setSearchingNearby] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

  const setMapLayers = useMapStore((state) => state.setMapLayers);
  const setOnMarkerClick = useMapStore((state) => state.setOnMarkerClick);
  const clearMap = useMapStore((state) => state.clearMap);

  useEffect(() => {
    const point = reference.place;
    if (!point) {
      setNearbyPlaces(null);
      setNearbyError(null);
      setSelectedPlaceId(null);
      return;
    }

    const controller = new AbortController();
    setSearchingNearby(true);
    setNearbyError(null);
    setSelectedPlaceId(null);
    searchNearbyPlaces(point.lat, point.lng, 'hospedagem', undefined, controller.signal)
      .then(setNearbyPlaces)
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setNearbyPlaces(null);
        setNearbyError(
          'Não foi possível buscar hospedagens agora. Você ainda pode preencher a estadia manualmente.',
        );
      })
      .finally(() => setSearchingNearby(false));

    return () => controller.abort();
  }, [reference.place]);

  const mapLayers = useMemo<readonly (MapLayerData & { visible: boolean })[]>(
    () =>
      nearbyPlaces === null
        ? []
        : [{
            id: LODGING_LAYER_ID,
            label: 'Hospedagens encontradas',
            visible: true,
            markers: nearbyPlaces.map((place) => ({
              id: place.id,
              lng: place.lng,
              lat: place.lat,
              label: place.name,
              kind: 'lodging',
            })),
          }],
    [nearbyPlaces],
  );

  useEffect(() => {
    setMapLayers(mapLayers);
  }, [mapLayers, setMapLayers]);

  function selectPlace(place: PlaceResult): void {
    setSelectedPlaceId(place.id);
    setPlaceName(place.name);
    setAddress(place.address);
    setCoords({ lat: place.lat, lng: place.lng });
  }

  useEffect(() => {
    setOnMarkerClick((layerId, markerId) => {
      if (layerId !== LODGING_LAYER_ID) return;
      const place = nearbyPlaces?.find((candidate) => candidate.id === markerId);
      if (place) selectPlace(place);
    });
  }, [nearbyPlaces, setOnMarkerClick]);

  // The shell keeps MapCanvas alive between modules; remove this module's data
  // explicitly so an asynchronous nearby response can never leak elsewhere.
  useEffect(() => {
    return () => clearMap();
  }, [clearMap]);

  const stay = useMemo<LodgingStay>(
    () => ({
      placeName: placeName.trim() || 'Hospedagem',
      address: address.trim() || null,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      checkIn,
      checkOut,
      pricePerNight: Number(pricePerNight),
    }),
    [address, checkIn, checkOut, coords, placeName, pricePerNight],
  );

  const result = useMemo(() => {
    try {
      return { cost: calculateLodgingCost(stay), error: null };
    } catch (cause) {
      return {
        cost: null,
        error: cause instanceof Error ? cause.message : 'Não foi possível calcular a hospedagem.',
      };
    }
  }, [stay]);
  const priceError = stay.pricePerNight < 0 ? result.error : null;

  return (
    <section className="map-panel-content mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Hospedagem</h1>
        <p className="text-sm text-muted-foreground">
          Calcule noites e custo total de uma estadia para incluir no roteiro.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Buscar perto de</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <PlaceSearch
            id="lodging-reference"
            label="Cidade, bairro ou endereço"
            value={reference}
            onChange={setReference}
            placeholder="Ex.: Copacabana, Rio de Janeiro"
          />

          {searchingNearby ? (
            <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" /> Buscando hospedagens...
            </p>
          ) : null}
          {nearbyError ? (
            <p role="alert" className="text-sm text-destructive">{nearbyError}</p>
          ) : null}
          {nearbyPlaces !== null && selectedPlaceId === null && !searchingNearby && !nearbyError ? (
            nearbyPlaces.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma hospedagem encontrada nesta região.
              </p>
            ) : (
              <ul aria-label="Hospedagens encontradas" className="calculator-nearby-grid grid gap-2 sm:grid-cols-2">
                {nearbyPlaces.map((place) => (
                  <li key={place.id}>
                    <button
                      type="button"
                      aria-pressed={selectedPlaceId === place.id}
                      onClick={() => selectPlace(place)}
                      className="flex w-full items-start gap-2 rounded-md border border-border p-3 text-left text-sm hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <MapPin aria-hidden className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <span>
                        <span className="block font-medium">{place.name}</span>
                        <span className="block text-muted-foreground">{place.address}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </CardContent>
      </Card>

      <div className="calculator-main-grid grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <CardHeader>
            <CardTitle>Dados da estadia</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={(event) => event.preventDefault()}>
              <div className="grid gap-1.5">
                <Label htmlFor="lodging-place">Nome do lugar</Label>
                <Input
                  id="lodging-place"
                  value={placeName}
                  onChange={(event) => setPlaceName(event.target.value)}
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="lodging-address">Endereço</Label>
                <Input
                  id="lodging-address"
                  value={address}
                  onChange={(event) => {
                    setAddress(event.target.value);
                    setCoords(null);
                  }}
                  placeholder="Opcional"
                />
              </div>

              <div className="calculator-form-grid grid gap-3 sm:grid-cols-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="lodging-check-in">Check-in</Label>
                  <Input
                    id="lodging-check-in"
                    type="date"
                    value={checkIn}
                    onChange={(event) => setCheckIn(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lodging-check-out">Check-out</Label>
                  <Input
                    id="lodging-check-out"
                    type="date"
                    value={checkOut}
                    onChange={(event) => setCheckOut(event.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lodging-price">Preço/noite</Label>
                  <Input
                    id="lodging-price"
                    type="number"
                    min="0"
                    step="0.01"
                    aria-invalid={priceError ? true : undefined}
                    aria-describedby={priceError ? 'lodging-price-error' : undefined}
                    value={pricePerNight}
                    onChange={(event) => setPricePerNight(event.target.value)}
                  />
                  {priceError ? (
                    <p id="lodging-price-error" role="alert" className="text-xs font-medium text-destructive">
                      {priceError}
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
            {result.error && !priceError ? (
              <p role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {result.error}
              </p>
            ) : null}
            {result.cost ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Noites" value={String(result.cost.nights)} />
                  <Metric label="Total" value={formatCurrency(result.cost.totalCost)} />
                </div>
                <SaveStayToTripDialog stay={stay} totalCost={result.cost.totalCost} />
              </>
            ) : null}
            <Button type="button" variant="outline" onClick={() => {
              setPlaceName(DEFAULT_STAY.placeName);
              setAddress('');
              setCoords(null);
              setCheckIn(DEFAULT_STAY.checkIn);
              setCheckOut(DEFAULT_STAY.checkOut);
              setPricePerNight(String(DEFAULT_STAY.pricePerNight));
            }}>
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

export const hospedagemModule: ModuleDefinition = {
  id: 'hospedagem',
  label: 'Hospedagem',
  icon: Hotel,
  path: MODULE_PATH,
  Panel: HospedagemPanel,
  showMap: true,
};
