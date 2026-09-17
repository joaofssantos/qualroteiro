/**
 * Curated Google Places (New) types offered as chips per module, one module
 * per `PlaceCategory`.
 *
 * Mirrors `PLACE_TYPE_ALLOWLIST` in `apps/api/src/providers/google-places.ts`
 * value-for-value (decision 1 of `orientation.md` for j-20260917-qv) — this
 * app has no shared package with `apps/api` (the same reason `PlaceCategory`
 * itself is redeclared in `./types` rather than imported), so the two lists
 * are kept in sync by hand. The API is the source of truth and the final
 * gate: it validates every `type` it receives against its own allow-list per
 * category regardless of what this app sends, so a drift here fails loudly
 * (a rejected request) rather than silently.
 *
 * Selecting a chip is additive within the category (multi-select), never
 * exclusive: zero chips selected keeps today's behaviour (the category's
 * single base Places type, e.g. `lodging`), one or more replaces it with the
 * selection.
 */

import type { PlaceCategory } from './types';

export interface PlaceTypeOption {
  /** The exact Places API (New) type value sent to `GET /places/nearby`. */
  readonly value: string;
  /** Portuguese label shown on the chip. */
  readonly label: string;
}

export const PLACE_TYPE_OPTIONS: Readonly<Record<PlaceCategory, readonly PlaceTypeOption[]>> = {
  hospedagem: [
    { value: 'hotel', label: 'Hotel' },
    { value: 'hostel', label: 'Hostel' },
    { value: 'guest_house', label: 'Pousada' },
    { value: 'resort_hotel', label: 'Resort' },
    { value: 'bed_and_breakfast', label: 'Cama e café' },
    { value: 'campground', label: 'Camping' },
  ],
  restaurantes: [
    { value: 'cafe', label: 'Café' },
    { value: 'bar', label: 'Bar' },
    { value: 'bakery', label: 'Padaria' },
    { value: 'fast_food_restaurant', label: 'Fast food' },
    { value: 'pizza_restaurant', label: 'Pizzaria' },
    { value: 'seafood_restaurant', label: 'Frutos do mar' },
    { value: 'steak_house', label: 'Churrascaria' },
    { value: 'vegetarian_restaurant', label: 'Vegetariano' },
  ],
  atividades: [
    { value: 'museum', label: 'Museu' },
    { value: 'park', label: 'Parque' },
    { value: 'amusement_park', label: 'Parque de diversões' },
    { value: 'art_gallery', label: 'Galeria de arte' },
    { value: 'zoo', label: 'Zoológico' },
    { value: 'historical_landmark', label: 'Marco histórico' },
    { value: 'national_park', label: 'Parque nacional' },
    { value: 'night_club', label: 'Balada' },
  ],
};

/** Reference marks for the radius control (decision 5 of the orientation spec). */
export interface RadiusOption {
  readonly meters: number;
  readonly label: string;
}

export const RADIUS_OPTIONS: readonly RadiusOption[] = [
  { meters: 1_000, label: '1 km' },
  { meters: 3_000, label: '3 km' },
  { meters: 5_000, label: '5 km' },
  { meters: 10_000, label: '10 km' },
  { meters: 20_000, label: '20 km' },
];

/** Matches the API's own default (`DEFAULT_NEARBY_RADIUS_METERS` in `apps/api/src/http/validate.ts`). */
export const DEFAULT_RADIUS_METERS = 3_000;
