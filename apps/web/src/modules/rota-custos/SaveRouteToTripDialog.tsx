import { Save } from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  createTrip,
  createTripDay,
  createTripItem,
  getTrip,
  listTrips,
  type TripDetail,
  type TripSummary,
} from '@/core/api/trips';
import { useQualAuth } from '@/core/auth/AuthContext';
import type { PlannedRoute } from '@/core/api/types';

import { MODULE_PATH as TRIPS_PATH } from '../planejamento-viagem/module';

const NEW_TRIP = '__new-trip__';
const NEW_DAY = '__new-day__';

interface SaveRouteToTripDialogProps {
  readonly route: PlannedRoute;
  readonly title: string;
}

export function SaveRouteToTripDialog({ route, title }: SaveRouteToTripDialogProps) {
  const auth = useQualAuth();
  const [open, setOpen] = useState(false);
  const [trips, setTrips] = useState<readonly TripSummary[]>([]);
  const [selectedTripId, setSelectedTripId] = useState(NEW_TRIP);
  const [tripDetail, setTripDetail] = useState<TripDetail | null>(null);
  const [selectedDayId, setSelectedDayId] = useState(NEW_DAY);
  const [newTripTitle, setNewTripTitle] = useState(title);
  const [newDayDate, setNewDayDate] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [savedTripId, setSavedTripId] = useState<string | null>(null);

  const costEstimate = useMemo(() => route.tolls.total + route.fuel.cost, [route.fuel.cost, route.tolls.total]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setStatus('loading');
    setError(null);
    listTrips(auth.getToken)
      .then((loadedTrips) => {
        if (cancelled) return;
        setTrips(loadedTrips);
        setSelectedTripId(loadedTrips[0]?.id ?? NEW_TRIP);
        setStatus('idle');
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar suas viagens.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [auth.getToken, open]);

  useEffect(() => {
    if (!open || selectedTripId === NEW_TRIP) {
      setTripDetail(null);
      setSelectedDayId(NEW_DAY);
      return;
    }

    let cancelled = false;
    getTrip(auth.getToken, selectedTripId)
      .then((trip) => {
        if (cancelled) return;
        setTripDetail(trip);
        setSelectedDayId(trip.days[0]?.id ?? NEW_DAY);
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : 'Não foi possível abrir a viagem.');
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [auth.getToken, open, selectedTripId]);

  if (!auth.isSignedIn) return null;

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('saving');
    setError(null);
    setSavedTripId(null);

    try {
      const trip = await (selectedTripId === NEW_TRIP
        ? createTrip(auth.getToken, { title: newTripTitle.trim() || title })
        : getTrip(auth.getToken, selectedTripId));
      const existingDayCount = selectedTripId === NEW_TRIP ? 0 : (trip as TripDetail).days.length;
      const day =
        selectedDayId === NEW_DAY
          ? await createTripDay(auth.getToken, trip.id, {
              date: newDayDate || null,
              order: existingDayCount,
            })
          : { id: selectedDayId };

      await createTripItem(auth.getToken, trip.id, day.id, {
        moduleId: 'rota-custos',
        kind: 'route',
        title,
        payload: route,
        costEstimate,
      });

      setSavedTripId(trip.id);
      setStatus('saved');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível salvar a rota.');
      setStatus('error');
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent" size="sm">
          <Save />
          Salvar na viagem
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar rota na viagem</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <form className="grid gap-4" onSubmit={onSave}>
          <div className="grid gap-1.5">
            <Label htmlFor="save-route-trip">Viagem</Label>
            <Select
              id="save-route-trip"
              value={selectedTripId}
              onChange={(event) => setSelectedTripId(event.target.value)}
              disabled={status === 'loading' || status === 'saving'}
            >
              {trips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
              <option value={NEW_TRIP}>Criar viagem rápida</option>
            </Select>
          </div>

          {selectedTripId === NEW_TRIP ? (
            <div className="grid gap-1.5">
              <Label htmlFor="save-route-trip-title">Título da viagem</Label>
              <Input
                id="save-route-trip-title"
                value={newTripTitle}
                onChange={(event) => setNewTripTitle(event.target.value)}
                disabled={status === 'saving'}
              />
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor="save-route-day">Dia</Label>
            <Select
              id="save-route-day"
              value={selectedDayId}
              onChange={(event) => setSelectedDayId(event.target.value)}
              disabled={status === 'saving' || selectedTripId === NEW_TRIP}
            >
              {tripDetail?.days.map((day, index) => (
                <option key={day.id} value={day.id}>
                  {day.date ?? `Dia ${index + 1}`}
                </option>
              ))}
              <option value={NEW_DAY}>Criar novo dia</option>
            </Select>
          </div>

          {selectedDayId === NEW_DAY ? (
            <div className="grid gap-1.5">
              <Label htmlFor="save-route-day-date">Data do dia</Label>
              <Input
                id="save-route-day-date"
                type="date"
                value={newDayDate}
                onChange={(event) => setNewDayDate(event.target.value)}
                disabled={status === 'saving'}
              />
            </div>
          ) : null}

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          {status === 'saved' && savedTripId ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              Rota salva. <Link className="font-semibold underline" to={`${TRIPS_PATH}/${savedTripId}`}>Abrir viagem</Link>
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button type="submit" disabled={status === 'loading' || status === 'saving'}>
              {status === 'saving' ? 'Salvando' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
