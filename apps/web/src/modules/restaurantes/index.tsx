import { Utensils } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

  return (
    <section className="min-h-screen bg-background px-4 py-6 md:px-8">
      <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid gap-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-primary">Restaurantes</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Calcule refeições por pessoa e salve o custo no planejamento da viagem.
            </p>
          </div>

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
                      value={people}
                      onChange={(event) => setPeople(event.target.value)}
                    />
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        <aside className="lg:pt-[76px]">
          <Card className="lg:sticky lg:top-6">
            <CardHeader>
              <CardTitle>Resumo</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
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

              {costResult.error ? (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {costResult.error}
                </p>
              ) : (
                <div className="rounded-md border border-border bg-secondary/50 p-4">
                  <span className="text-xs font-medium uppercase text-muted-foreground">Total estimado</span>
                  <p className="mt-1 text-3xl font-semibold text-primary">
                    {formatCurrency(costResult.cost!.totalCost)}
                  </p>
                </div>
              )}

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
};
