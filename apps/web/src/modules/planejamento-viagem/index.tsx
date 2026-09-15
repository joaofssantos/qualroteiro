import { CalendarDays, Plus, WalletCards } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createTrip,
  getTrip,
  listTrips,
  type TripDetail,
  type TripSummary,
} from '@/core/api/trips';
import { useQualAuth } from '@/core/auth/AuthContext';
import type { ModuleDefinition } from '@/core/registry/types';
import { formatCurrency } from '@/lib/format';

import { MODULE_PATH } from './module';

function PlanningPanel() {
  const auth = useQualAuth();

  if (!auth.isSignedIn) {
    return (
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-4 py-10">
        <EmptyState
          title="Entre para planejar viagens"
          description="Suas viagens salvas ficam vinculadas à sua conta e podem combinar rota, hospedagem, restaurantes e atividades."
        />
      </section>
    );
  }

  return (
    <Routes>
      <Route index element={<TripListScreen />} />
      <Route path=":tripId" element={<TripDetailScreen />} />
    </Routes>
  );
}

function TripListScreen() {
  const auth = useQualAuth();
  const [trips, setTrips] = useState<readonly TripSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      setTrips(await listTrips(auth.getToken));
      setStatus('ready');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar viagens.');
      setStatus('error');
    }
  }, [auth.getToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError(null);
    try {
      await createTrip(auth.getToken, {
        title: title.trim(),
        startDate: startDate || null,
        endDate: endDate || null,
      });
      setTitle('');
      setStartDate('');
      setEndDate('');
      await reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a viagem.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-primary">Planejamento de Viagem</h1>
        <p className="text-sm text-muted-foreground">
          Organize dias, itens salvos dos módulos e uma visão consolidada do orçamento.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Nova viagem</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-[1fr_9rem_9rem_auto]" onSubmit={onCreate}>
            <div className="space-y-1.5">
              <Label htmlFor="trip-title">Título</Label>
              <Input
                id="trip-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Férias no litoral"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-start">Início</Label>
              <Input id="trip-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-end">Fim</Label>
              <Input id="trip-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </div>
            <Button type="submit" className="self-end" disabled={creating || !title.trim()}>
              <Plus />
              Criar
            </Button>
          </form>
        </CardContent>
      </Card>

      {error ? <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p> : null}

      {status === 'loading' ? (
        <EmptyState title="Carregando viagens" />
      ) : trips.length === 0 ? (
        <EmptyState title="Nenhuma viagem criada" description="Crie uma viagem para começar a salvar resultados dos módulos." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {trips.map((trip) => (
            <Link key={trip.id} to={`${MODULE_PATH}/${trip.id}`} className="block">
              <Card className="h-full transition-colors hover:border-primary/40 hover:bg-secondary/30">
                <CardHeader>
                  <CardTitle>{trip.title}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 text-sm text-muted-foreground">
                  <p>{dateRange(trip.startDate, trip.endDate)}</p>
                  <div className="flex gap-4">
                    <span>{trip.dayCount} dias</span>
                    <span>{trip.itemCount} itens</span>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function TripDetailScreen() {
  const { tripId } = useParams();
  const auth = useQualAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    getTrip(auth.getToken, tripId)
      .then((loaded) => {
        if (!cancelled) setTrip(loaded);
      })
      .catch((cause) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Viagem não encontrada.');
      });
    return () => {
      cancelled = true;
    };
  }, [auth.getToken, tripId]);

  const total = useMemo(
    () =>
      trip?.days.reduce(
        (sum, day) => sum + day.items.reduce((daySum, item) => daySum + (item.costEstimate ?? 0), 0),
        0,
      ) ?? 0,
    [trip],
  );

  if (error) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState title="Não foi possível abrir a viagem" description={error} />
      </section>
    );
  }

  if (!trip) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-8">
        <EmptyState title="Carregando viagem" />
      </section>
    );
  }

  return (
    <section className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 md:px-8">
      <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link to={MODULE_PATH}>Voltar</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight text-primary">{trip.title}</h1>
          <p className="text-sm text-muted-foreground">{dateRange(trip.startDate, trip.endDate)}</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm">
          <WalletCards className="size-4 text-accent" />
          <span className="font-semibold text-primary">{formatCurrency(total)}</span>
        </div>
      </header>

      {trip.days.length === 0 ? (
        <EmptyState title="Ainda sem dias" description="Salve uma rota em uma viagem para criar o primeiro item do roteiro." />
      ) : (
        <div className="grid gap-3">
          {trip.days.map((day, index) => (
            <Card key={day.id}>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-accent" />
                  {day.date ?? `Dia ${index + 1}`}
                </CardTitle>
                <span className="text-xs text-muted-foreground">{day.items.length} itens</span>
              </CardHeader>
              <CardContent>
                {day.items.length === 0 ? (
                  <EmptyState title="Dia vazio" />
                ) : (
                  <ol className="grid gap-2">
                    {day.items.map((item) => (
                      <li key={item.id} className="rounded-md border border-border bg-secondary/30 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                            <p className="text-xs text-muted-foreground">{item.moduleId} · {item.kind}</p>
                          </div>
                          {item.costEstimate != null ? (
                            <span className="text-sm font-semibold text-primary">{formatCurrency(item.costEstimate)}</span>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function dateRange(startDate: string | null, endDate: string | null): string {
  if (startDate && endDate) return `${startDate} a ${endDate}`;
  if (startDate) return `A partir de ${startDate}`;
  if (endDate) return `Até ${endDate}`;
  return 'Datas flexíveis';
}

export const planejamentoViagemModule: ModuleDefinition = {
  id: 'planejamento-viagem',
  label: 'Planejamento',
  icon: CalendarDays,
  path: MODULE_PATH,
  Panel: PlanningPanel,
};
