import { Ticket } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

function AtividadesPanel() {
  const [placeName, setPlaceName] = useState(DEFAULT_PLAN.placeName);
  const [address, setAddress] = useState('');
  const [date, setDate] = useState(DEFAULT_PLAN.date ?? '');
  const [pricePerPerson, setPricePerPerson] = useState(String(DEFAULT_PLAN.pricePerPerson));
  const [people, setPeople] = useState(String(DEFAULT_PLAN.people));

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

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Atividades</h1>
        <p className="text-sm text-muted-foreground">
          Calcule o custo total de um passeio ou ingresso para incluir no roteiro.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
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

              <div className="grid gap-3 sm:grid-cols-3">
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
                    value={people}
                    onChange={(event) => setPeople(event.target.value)}
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
                <Metric label="Total" value={formatCurrency(result.cost.totalCost)} />
                <SaveActivityToTripDialog plan={plan} totalCost={result.cost.totalCost} />
              </>
            ) : (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {result.error}
              </p>
            )}
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
};
