/**
 * Environment reading for the api unit.
 *
 * ORS_* are this unit's own vars. DATABASE_URL / REDIS_URL / VALHALLA_URL /
 * PHOTON_URL are owned and injected by `qualroteiro/root` and are deliberately
 * NOT read here — F1 uses the managed provider and has no persistence.
 */

export interface OrsEnv {
  readonly apiKey: string;
  readonly baseUrl: string;
}

export const DEFAULT_ORS_BASE_URL = 'https://api.openrouteservice.org';

/**
 * Read the OpenRouteService configuration.
 *
 * @throws {Error} at startup if `ORS_API_KEY` is absent — failing loudly in the
 * composition root beats every request failing later with a confusing 502.
 */
export function readOrsEnv(env: NodeJS.ProcessEnv = process.env): OrsEnv {
  const apiKey = env['ORS_API_KEY']?.trim();

  if (apiKey === undefined || apiKey.length === 0) {
    throw new Error(
      'ORS_API_KEY is not set. Copy apps/api/.env.example and provide an OpenRouteService API key.',
    );
  }

  return {
    apiKey,
    baseUrl: env['ORS_BASE_URL']?.trim() || DEFAULT_ORS_BASE_URL,
  };
}
