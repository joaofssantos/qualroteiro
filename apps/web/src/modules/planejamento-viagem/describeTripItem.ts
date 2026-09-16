import type { TripItem } from '@/core/api/trips';
import { formatCurrency, formatDuration, formatKm } from '@/lib/format';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function rawLabel(item: TripItem): string {
  return `${item.moduleId} · ${item.kind}`;
}

/** Nights between two ISO `YYYY-MM-DD` dates, or `null` if they don't parse cleanly. */
function nightsBetween(checkIn: string, checkOut: string): number | null {
  const inMs = Date.parse(checkIn);
  const outMs = Date.parse(checkOut);
  if (Number.isNaN(inMs) || Number.isNaN(outMs)) return null;
  const nights = Math.round((outMs - inMs) / MS_PER_DAY);
  return nights > 0 ? nights : null;
}

function describeRotaCustos(item: TripItem): string {
  const payload = item.payload;
  if (
    isRecord(payload) &&
    typeof payload.distanceKm === 'number' &&
    typeof payload.durationMin === 'number'
  ) {
    return `${item.title} · ${formatKm(payload.distanceKm)} · ${formatDuration(payload.durationMin)}`;
  }
  return item.title;
}

function describeHospedagem(item: TripItem): string {
  const payload = item.payload;
  if (
    isRecord(payload) &&
    typeof payload.checkIn === 'string' &&
    typeof payload.checkOut === 'string' &&
    typeof payload.pricePerNight === 'number'
  ) {
    const nights = nightsBetween(payload.checkIn, payload.checkOut);
    if (nights !== null) {
      return `${nights} ${nights === 1 ? 'noite' : 'noites'} · ${formatCurrency(payload.pricePerNight)}/noite`;
    }
  }
  return rawLabel(item);
}

function describePeoplePricing(item: TripItem): string {
  const payload = item.payload;
  if (
    isRecord(payload) &&
    typeof payload.people === 'number' &&
    typeof payload.pricePerPerson === 'number'
  ) {
    return `${payload.people} ${payload.people === 1 ? 'pessoa' : 'pessoas'} · ${formatCurrency(payload.pricePerPerson)}/pessoa`;
  }
  return rawLabel(item);
}

/**
 * Human-readable, per-module summary of a saved trip item.
 *
 * `payload` is `unknown` by contract, and `moduleId` is free-form so future
 * modules can appear without an API change — every branch narrows `payload`
 * defensively (presence + `typeof` checks, no `as` casts) and falls back to
 * the raw `"{moduleId} · {kind}"` text for anything that doesn't narrow
 * cleanly or that this function doesn't recognize. Never throws.
 */
export function describeTripItem(item: TripItem): string {
  switch (item.moduleId) {
    case 'rota-custos':
      return describeRotaCustos(item);
    case 'hospedagem':
      return describeHospedagem(item);
    case 'restaurantes':
    case 'atividades':
      return describePeoplePricing(item);
    default:
      return rawLabel(item);
  }
}
