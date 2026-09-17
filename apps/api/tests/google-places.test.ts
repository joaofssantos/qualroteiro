/**
 * The Google Places (New) Nearby Search adapter, against a stubbed `fetch`.
 *
 * Proves the category→`includedTypes` mapping, the vendor→domain shape
 * mapping, the field mask actually sent, and the `ProviderError` paths —
 * without contacting Google.
 */

import { describe, expect, it } from 'vitest';

import { ProviderError } from '../src/errors.js';
import { createGooglePlacesProvider } from '../src/providers/google-places.js';
import { jsonResponse, recordingFetch } from './helpers/recording-fetch.js';

const SP = { lat: -23.5505, lng: -46.6333 };

const GOOGLE_NEARBY_OK = {
  places: [
    {
      id: 'ChIJ_fake123',
      displayName: { text: 'Pousada Vista Mar', languageCode: 'pt-BR' },
      formattedAddress: 'Av. Beira Mar, 100 - Centro, Ubatuba - SP',
      location: { latitude: -23.55, longitude: -45.07 },
    },
  ],
};

describe('createGooglePlacesProvider', () => {
  it('maps a Places API (New) response to PlaceResult[]', async () => {
    const stub = recordingFetch(() => jsonResponse(GOOGLE_NEARBY_OK));
    const provider = createGooglePlacesProvider({
      apiKey: 'test-key',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    const results = await provider.searchNearby({
      ...SP,
      category: 'hospedagem',
      radiusMeters: 3000,
    });

    expect(results).toEqual([
      {
        id: 'ChIJ_fake123',
        name: 'Pousada Vista Mar',
        address: 'Av. Beira Mar, 100 - Centro, Ubatuba - SP',
        lat: -23.55,
        lng: -45.07,
        category: 'hospedagem',
      },
    ]);
  });

  it('calls the Nearby Search endpoint with the API key, field mask, and a small field mask', async () => {
    const stub = recordingFetch(() => jsonResponse(GOOGLE_NEARBY_OK));
    const provider = createGooglePlacesProvider({
      apiKey: 'super-secret-key',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    await provider.searchNearby({ ...SP, category: 'hospedagem', radiusMeters: 3000 });

    expect(stub.call(0).url).toBe('https://places.example/v1/places:searchNearby');
    const headers = stub.call(0).init.headers as Record<string, string>;
    expect(headers['X-Goog-Api-Key']).toBe('super-secret-key');
    expect(headers['X-Goog-FieldMask']).toBe(
      'places.id,places.displayName,places.formattedAddress,places.location',
    );
  });

  it.each([
    ['hospedagem', 'lodging'],
    ['restaurantes', 'restaurant'],
    ['atividades', 'tourist_attraction'],
  ] as const)('maps category %s to includedTypes [%s]', async (category, includedType) => {
    const stub = recordingFetch(() => jsonResponse({ places: [] }));
    const provider = createGooglePlacesProvider({
      apiKey: 'k',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    await provider.searchNearby({ ...SP, category, radiusMeters: 3000 });

    const body = stub.body(0);
    expect(body['includedTypes']).toEqual([includedType]);
  });

  it.each([
    ['absent (no types field at all)', undefined],
    ['empty array', [] as const],
  ] as const)(
    'falls back to the single base includedType when types is %s (zero regression)',
    async (_label, types) => {
      const stub = recordingFetch(() => jsonResponse({ places: [] }));
      const provider = createGooglePlacesProvider({
        apiKey: 'k',
        baseUrl: 'https://places.example',
        fetchImpl: stub.impl,
      });

      await provider.searchNearby({ ...SP, category: 'restaurantes', radiusMeters: 3000, types });

      // Same includedTypes the pre-change behaviour sent: exactly the one
      // base type for the category, nothing else.
      expect(stub.body(0)['includedTypes']).toEqual(['restaurant']);
    },
  );

  it('sends the selected types instead of the base type when types is non-empty', async () => {
    const stub = recordingFetch(() => jsonResponse({ places: [] }));
    const provider = createGooglePlacesProvider({
      apiKey: 'k',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    await provider.searchNearby({
      ...SP,
      category: 'restaurantes',
      radiusMeters: 3000,
      types: ['cafe', 'bakery'],
    });

    // Replaces (does not append to) the base type.
    expect(stub.body(0)['includedTypes']).toEqual(['cafe', 'bakery']);
  });

  it('sends the requested radius in locationRestriction.circle', async () => {
    const stub = recordingFetch(() => jsonResponse({ places: [] }));
    const provider = createGooglePlacesProvider({
      apiKey: 'k',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    await provider.searchNearby({ ...SP, category: 'restaurantes', radiusMeters: 5000 });

    const body = stub.body(0) as {
      locationRestriction: { circle: { center: unknown; radius: number } };
    };
    expect(body.locationRestriction.circle.radius).toBe(5000);
    expect(body.locationRestriction.circle.center).toEqual({
      latitude: SP.lat,
      longitude: SP.lng,
    });
  });

  it('returns an empty array when Google omits the places key (no matches)', async () => {
    const stub = recordingFetch(() => jsonResponse({}));
    const provider = createGooglePlacesProvider({
      apiKey: 'k',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    const results = await provider.searchNearby({
      ...SP,
      category: 'atividades',
      radiusMeters: 3000,
    });

    expect(results).toEqual([]);
  });

  it('drops a place missing usable id/name/address/location', async () => {
    const stub = recordingFetch(() =>
      jsonResponse({
        places: [
          { id: 'no-name-or-location' },
          {
            id: 'ok-1',
            displayName: { text: 'Restaurante Bom Prato' },
            formattedAddress: 'Rua X, 1',
            location: { latitude: -23.5, longitude: -46.6 },
          },
        ],
      }),
    );
    const provider = createGooglePlacesProvider({
      apiKey: 'k',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    const results = await provider.searchNearby({
      ...SP,
      category: 'restaurantes',
      radiusMeters: 3000,
    });

    expect(results).toHaveLength(1);
    expect(results[0]?.id).toBe('ok-1');
  });

  it('throws ProviderError on a non-2xx response', async () => {
    const stub = recordingFetch(() => jsonResponse({ error: { message: 'invalid key' } }, 403));
    const provider = createGooglePlacesProvider({
      apiKey: 'k',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    await expect(
      provider.searchNearby({ ...SP, category: 'hospedagem', radiusMeters: 3000 }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('throws ProviderError when the transport fails (covers timeout)', async () => {
    const stub = recordingFetch(() => {
      throw new DOMException('The operation was aborted.', 'TimeoutError');
    });
    const provider = createGooglePlacesProvider({
      apiKey: 'k',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    await expect(
      provider.searchNearby({ ...SP, category: 'hospedagem', radiusMeters: 3000 }),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('throws ProviderError on invalid JSON', async () => {
    const stub = recordingFetch(
      () => new Response('not json', { status: 200, headers: { 'Content-Type': 'text/plain' } }),
    );
    const provider = createGooglePlacesProvider({
      apiKey: 'k',
      baseUrl: 'https://places.example',
      fetchImpl: stub.impl,
    });

    await expect(
      provider.searchNearby({ ...SP, category: 'hospedagem', radiusMeters: 3000 }),
    ).rejects.toBeInstanceOf(ProviderError);
  });
});
