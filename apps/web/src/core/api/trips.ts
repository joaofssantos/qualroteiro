import { ApiError } from './errors';
import type { ApiErrorBody } from './types';

export interface Trip {
  readonly id: string;
  readonly userId: string;
  readonly title: string;
  readonly startDate: string | null;
  readonly endDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TripSummary extends Trip {
  readonly dayCount: number;
  readonly itemCount: number;
}

export interface TripDay {
  readonly id: string;
  readonly tripId: string;
  readonly date: string | null;
  readonly order: number;
}

export interface TripItem {
  readonly id: string;
  readonly tripDayId: string;
  readonly order: number;
  readonly moduleId: 'rota-custos' | 'hospedagem' | 'restaurantes' | 'atividades' | string;
  readonly kind: string;
  readonly title: string;
  readonly payload: unknown;
  readonly costEstimate: number | null;
}

export interface TripDetail extends Trip {
  readonly days: readonly (TripDay & { readonly items: readonly TripItem[] })[];
}

export interface CreateTripInput {
  readonly title: string;
  readonly startDate?: string | null;
  readonly endDate?: string | null;
}

export interface CreateTripDayInput {
  readonly date?: string | null;
  readonly order?: number;
}

export interface CreateTripItemInput {
  readonly moduleId: string;
  readonly kind: string;
  readonly title: string;
  readonly payload: unknown;
  readonly costEstimate?: number | null;
}

export interface UpdateTripDayInput {
  readonly date?: string | null;
  readonly order?: number;
}

export interface UpdateTripItemInput {
  readonly order?: number;
  readonly tripDayId?: string;
}

type TokenProvider = () => Promise<string | null>;

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

function url(path: string): string {
  return `${BASE_URL.replace(/\/$/, '')}${path}`;
}

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody>;
    if (typeof body.error === 'string' && body.error.length > 0) return body.error;
  } catch {
    // Non-JSON errors still deserve a useful message.
  }
  return response.statusText || `HTTP ${response.status}`;
}

async function authHeaders(getToken: TokenProvider): Promise<HeadersInit> {
  const token = await getToken();
  if (!token) throw new ApiError('auth', 401, 'Faça login para acessar suas viagens.');
  return {
    Authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  };
}

async function request<T>(
  path: string,
  getToken: TokenProvider,
  init: Omit<RequestInit, 'headers'> = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url(path), {
      ...init,
      headers: await authHeaders(getToken),
    });
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;
    throw new ApiError('network', 0, cause instanceof Error ? cause.message : 'network error');
  }

  if (!response.ok) throw new ApiError(response.status === 401 ? 'auth' : 'server', response.status, await errorMessage(response));
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export async function listTrips(getToken: TokenProvider): Promise<readonly TripSummary[]> {
  const body = await request<{ readonly trips: readonly TripSummary[] }>('/trips', getToken);
  return body.trips;
}

export function createTrip(getToken: TokenProvider, input: CreateTripInput): Promise<Trip> {
  return request('/trips', getToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getTrip(getToken: TokenProvider, id: string): Promise<TripDetail> {
  return request(`/trips/${encodeURIComponent(id)}`, getToken);
}

export function createTripDay(
  getToken: TokenProvider,
  tripId: string,
  input: CreateTripDayInput,
): Promise<TripDay> {
  return request(`/trips/${encodeURIComponent(tripId)}/days`, getToken, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createTripItem(
  getToken: TokenProvider,
  tripId: string,
  dayId: string,
  input: CreateTripItemInput,
): Promise<TripItem> {
  return request(
    `/trips/${encodeURIComponent(tripId)}/days/${encodeURIComponent(dayId)}/items`,
    getToken,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export function updateTripDay(
  getToken: TokenProvider,
  tripId: string,
  dayId: string,
  input: UpdateTripDayInput,
): Promise<TripDay> {
  return request(`/trips/${encodeURIComponent(tripId)}/days/${encodeURIComponent(dayId)}`, getToken, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function updateTripItem(
  getToken: TokenProvider,
  tripId: string,
  dayId: string,
  itemId: string,
  input: UpdateTripItemInput,
): Promise<TripItem> {
  return request(
    `/trips/${encodeURIComponent(tripId)}/days/${encodeURIComponent(dayId)}/items/${encodeURIComponent(itemId)}`,
    getToken,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );
}

export function deleteTripItem(
  getToken: TokenProvider,
  tripId: string,
  dayId: string,
  itemId: string,
): Promise<void> {
  return request(
    `/trips/${encodeURIComponent(tripId)}/days/${encodeURIComponent(dayId)}/items/${encodeURIComponent(itemId)}`,
    getToken,
    { method: 'DELETE' },
  );
}
