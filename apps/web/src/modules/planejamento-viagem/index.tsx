import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { CalendarDays, GripVertical, Plus, Trash2, WalletCards } from 'lucide-react';
import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, EmptyState } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createTrip,
  deleteTripItem,
  getTrip,
  listTrips,
  updateTripDay,
  updateTripItem,
  type TripDay,
  type TripDetail,
  type TripItem,
  type TripSummary,
} from '@/core/api/trips';
import { useQualAuth } from '@/core/auth/AuthContext';
import type { ModuleDefinition } from '@/core/registry/types';
import { formatCurrency } from '@/lib/format';

import { describeTripItem } from './describeTripItem';
import { MODULE_PATH } from './module';

type TripDayWithItems = TripDetail['days'][number];
type MutableTripDay = TripDay & { items: TripItem[] };
type ReorderPatch =
  | { kind: 'days'; days: readonly MutableTripDay[] }
  | { kind: 'items'; updates: readonly { currentDayId: string; item: TripItem }[] };

const dayDragId = (dayId: string): string => `day:${dayId}`;
const itemDragId = (itemId: string): string => `item:${itemId}`;

function cloneTrip(trip: TripDetail): TripDetail {
  return {
    ...trip,
    days: trip.days.map((day) => ({
      ...day,
      items: [...day.items],
    })),
  };
}

function dayIdFromDragId(id: string): string | null {
  return id.startsWith('day:') ? id.slice(4) : null;
}

function itemIdFromDragId(id: string): string | null {
  return id.startsWith('item:') ? id.slice(5) : null;
}

function normaliseDays(days: readonly MutableTripDay[]): MutableTripDay[] {
  return days.map((day, order) => ({ ...day, order }));
}

function normaliseItems(day: MutableTripDay): MutableTripDay {
  return {
    ...day,
    items: day.items.map((item, order) => ({ ...item, tripDayId: day.id, order })),
  };
}

function findItemLocation(
  days: readonly MutableTripDay[],
  itemId: string,
): { dayIndex: number; itemIndex: number } | null {
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const itemIndex = days[dayIndex]?.items.findIndex((item) => item.id === itemId) ?? -1;
    if (itemIndex >= 0) return { dayIndex, itemIndex };
  }
  return null;
}

function applyDragEnd(trip: TripDetail, event: DragEndEvent): { trip: TripDetail; patch: ReorderPatch } | null {
  const activeId = String(event.active.id);
  const overId = event.over ? String(event.over.id) : null;
  if (!overId || activeId === overId) return null;

  const activeDayId = dayIdFromDragId(activeId);
  const overDayId = dayIdFromDragId(overId);
  const days = cloneTrip(trip).days.map((day) => ({ ...day, items: [...day.items] }));

  if (activeDayId !== null && overDayId !== null) {
    const from = days.findIndex((day) => day.id === activeDayId);
    const to = days.findIndex((day) => day.id === overDayId);
    if (from < 0 || to < 0) return null;

    const reorderedDays = normaliseDays(arrayMove(days, from, to));
    return { trip: { ...trip, days: reorderedDays }, patch: { kind: 'days', days: reorderedDays } };
  }

  const activeItemId = itemIdFromDragId(activeId);
  if (activeItemId === null) return null;

  const activeLocation = findItemLocation(days, activeItemId);
  if (activeLocation === null) return null;
  const sourceDay = days[activeLocation.dayIndex];
  if (!sourceDay) return null;

  const overItemId = itemIdFromDragId(overId);
  const overLocation = overItemId === null ? null : findItemLocation(days, overItemId);
  const targetDayIndex =
    overLocation?.dayIndex ?? (overDayId === null ? -1 : days.findIndex((day) => day.id === overDayId));
  if (targetDayIndex < 0) return null;
  const targetDay = days[targetDayIndex];
  if (!targetDay) return null;

  const [moved] = sourceDay.items.splice(activeLocation.itemIndex, 1);
  if (!moved) return null;

  const targetIndex =
    overLocation === null ? targetDay.items.length : overLocation.itemIndex;

  targetDay.items.splice(targetIndex, 0, moved);
  const affected = new Set([activeLocation.dayIndex, targetDayIndex]);
  const nextDays = days.map((day, index) => (affected.has(index) ? normaliseItems(day) : day));
  const sourceTripDay = trip.days[activeLocation.dayIndex];
  if (!sourceTripDay) return null;
  const updates = [...affected].flatMap((dayIndex) => {
    const day = nextDays[dayIndex];
    if (!day) return [];
    return day.items.map((item) => ({
      currentDayId:
        item.id === moved.id ? sourceTripDay.id : day.id,
      item,
    }));
  });

  return { trip: { ...trip, days: nextDays }, patch: { kind: 'items', updates } };
}

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

export function TripDetailScreen() {
  const { tripId } = useParams();
  const auth = useQualAuth();
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const reload = useCallback(async () => {
    if (!tripId) return;
    try {
      setTrip(await getTrip(auth.getToken, tripId));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Viagem não encontrada.');
    }
  }, [auth.getToken, tripId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function onDeleteItem(dayId: string, item: TripItem) {
    if (!tripId) return;
    if (!window.confirm(`Excluir "${item.title}" desta viagem?`)) return;
    setDeletingItemId(item.id);
    setActionError(null);
    try {
      await deleteTripItem(auth.getToken, tripId, dayId, item.id);
      await reload();
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Não foi possível excluir o item.');
    } finally {
      setDeletingItemId(null);
    }
  }

  async function persistReorder(patch: ReorderPatch) {
    if (!tripId) return;

    if (patch.kind === 'days') {
      await Promise.all(
        patch.days.map((day) => updateTripDay(auth.getToken, tripId, day.id, { order: day.order })),
      );
      return;
    }

    await Promise.all(
      patch.updates.map(({ currentDayId, item }) =>
        updateTripItem(auth.getToken, tripId, currentDayId, item.id, {
          order: item.order,
          tripDayId: item.tripDayId,
        }),
      ),
    );
  }

  async function onDragEnd(event: DragEndEvent) {
    if (!trip || savingOrder) return;
    const result = applyDragEnd(trip, event);
    if (result === null) return;

    const previous = trip;
    setTrip(result.trip);
    setSavingOrder(true);
    setActionError(null);
    try {
      await persistReorder(result.patch);
    } catch (cause) {
      setTrip(previous);
      setActionError(cause instanceof Error ? cause.message : 'Não foi possível salvar a nova ordem.');
    } finally {
      setSavingOrder(false);
    }
  }

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
          <span className="font-semibold text-primary" data-testid="trip-budget-total">
            {formatCurrency(total)}
          </span>
        </div>
      </header>

      {actionError ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {actionError}
        </p>
      ) : null}

      {trip.days.length === 0 ? (
        <EmptyState title="Ainda sem dias" description="Salve uma rota em uma viagem para criar o primeiro item do roteiro." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => void onDragEnd(event)}>
          <SortableContext items={trip.days.map((day) => dayDragId(day.id))} strategy={verticalListSortingStrategy}>
            <div className="grid gap-3" aria-busy={savingOrder}>
              {trip.days.map((day, index) => (
                <SortableDayCard
                  key={day.id}
                  day={day}
                  dayIndex={index}
                  deletingItemId={deletingItemId}
                  onDeleteItem={onDeleteItem}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}

function SortableDayCard({
  day,
  dayIndex,
  deletingItemId,
  onDeleteItem,
}: {
  readonly day: TripDayWithItems;
  readonly dayIndex: number;
  readonly deletingItemId: string | null;
  readonly onDeleteItem: (dayId: string, item: TripItem) => void | Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: dayDragId(day.id),
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <Card ref={setNodeRef} style={style} className={isDragging ? 'opacity-70' : undefined}>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex min-w-0 items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8 shrink-0 cursor-grab active:cursor-grabbing"
            aria-label={`Reordenar ${day.date ?? `Dia ${dayIndex + 1}`}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4 text-muted-foreground" />
          </Button>
          <CalendarDays className="size-4 shrink-0 text-accent" />
          <span className="truncate">{day.date ?? `Dia ${dayIndex + 1}`}</span>
        </CardTitle>
        <span className="shrink-0 text-xs text-muted-foreground">{day.items.length} itens</span>
      </CardHeader>
      <CardContent>
        <SortableContext
          items={day.items.map((item) => itemDragId(item.id))}
          strategy={verticalListSortingStrategy}
        >
          {day.items.length === 0 ? (
            <div id={dayDragId(day.id)}>
              <EmptyState title="Dia vazio" />
            </div>
          ) : (
            <ol className="grid gap-2">
              {day.items.map((item) => (
                <SortableTripItem
                  key={item.id}
                  dayId={day.id}
                  item={item}
                  deletingItemId={deletingItemId}
                  onDeleteItem={onDeleteItem}
                />
              ))}
            </ol>
          )}
        </SortableContext>
      </CardContent>
    </Card>
  );
}

function SortableTripItem({
  dayId,
  item,
  deletingItemId,
  onDeleteItem,
}: {
  readonly dayId: string;
  readonly item: TripItem;
  readonly deletingItemId: string | null;
  readonly onDeleteItem: (dayId: string, item: TripItem) => void | Promise<void>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: itemDragId(item.id),
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`rounded-md border border-border bg-secondary/30 px-3 py-2 ${isDragging ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="mt-0.5 size-7 shrink-0 cursor-grab active:cursor-grabbing"
            aria-label={`Reordenar ${item.title}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4 text-muted-foreground" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">{item.title}</p>
            <p className="text-xs text-muted-foreground">{describeTripItem(item)}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {item.costEstimate != null ? (
            <span className="text-sm font-semibold text-primary">{formatCurrency(item.costEstimate)}</span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={`Excluir ${item.title}`}
            disabled={deletingItemId === item.id}
            onClick={() => void onDeleteItem(dayId, item)}
          >
            <Trash2 className="size-4 text-destructive" />
          </Button>
        </div>
      </div>
    </li>
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
