/**
 * pt-BR presentation helpers.
 *
 * Centralised so that "R$ 52,90" is spelled the same way in the summary row, the
 * plaza list and the drawer — three places that would otherwise drift.
 */

const brl = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const oneDecimal = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const twoDecimals = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** `52.9` → `R$ 52,90`. */
export function formatCurrency(value: number): string {
  return brl.format(value);
}

/** `429.7` → `429,7 km`. */
export function formatKm(value: number): string {
  return `${oneDecimal.format(value)} km`;
}

/** `42.97` → `42,97 L`. */
export function formatLiters(value: number): string {
  return `${twoDecimals.format(value)} L`;
}

/**
 * `342.5` → `5 h 43 min`.
 *
 * Minutes are rounded, not truncated, and the hour part is dropped below 60 min
 * so a short leg does not read "0 h 24 min".
 */
export function formatDuration(minutes: number): string {
  const total = Math.round(minutes);
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (hours === 0) return `${rest} min`;
  return `${hours} h ${String(rest).padStart(2, '0')} min`;
}

/** `123.4` → `km 123`, for a plaza's corridor-relative position. */
export function formatKmMarker(value: number): string {
  return `km ${Math.round(value)}`;
}
