import { Hotel } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ModuleDefinition } from '@/core/registry/types';
import { formatCurrency } from '@/lib/format';

import { calculateLodgingCost, type LodgingStay } from './calc';
import { MODULE_PATH } from './module';
import { SaveStayToTripDialog } from './SaveStayToTripDialog';

const DEFAULT_STAY: LodgingStay = {
  placeName: 'Hotel Atlântico',
  address: null,
  checkIn: '2026-10-01',
  checkOut: '2026-10-03',
  pricePerNight: 320,
};

function HospedagemPanel() {
  const [placeName, setPlaceName] = useState(DEFAULT_STAY.placeName);
  const [address, setAddress] = useState('');
  const [checkIn, setCheckIn] = useState(DEFAULT_STAY.checkIn);
  const [checkOut, setCheckOut] = useState(DEFAULT_STAY.checkOut);
  const [pricePerNight, setPricePerNight] = useState(String(DEFAULT_STAY.pricePerNight));

  const stay = useMemo<LodgingStay>(
    () => ({
      placeName: placeName.trim() || 'Hospedagem',
      address: address.trim() || null,
      checkIn,
      checkOut,
      pricePerNight: Number(pricePerNight),
    }),
    [address, checkIn, checkOut, placeName, pricePerNight],
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

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Hospedagem</h1>
        <p className="text-sm text-muted-foreground">
          Calcule noites e custo total de uma estadia para incluir no roteiro.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
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
                  onChange={(event) => setAddress(event.target.value)}
                  placeholder="Opcional"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
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
                    value={pricePerNight}
                    onChange={(event) => setPricePerNight(event.target.value)}
                  />
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
            {result.cost ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Metric label="Noites" value={String(result.cost.nights)} />
                  <Metric label="Total" value={formatCurrency(result.cost.totalCost)} />
                </div>
                <SaveStayToTripDialog stay={stay} totalCost={result.cost.totalCost} />
              </>
            ) : (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {result.error}
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => {
              setPlaceName(DEFAULT_STAY.placeName);
              setAddress('');
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
};
