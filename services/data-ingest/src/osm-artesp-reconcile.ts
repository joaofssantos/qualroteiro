/**
 * Keeps regulator-published ARTESP fares authoritative after every OSM
 * refresh. OSM remains the source for plaza identity and geometry, but its
 * community-maintained `charge` value must not undo an audited tariff.
 */

import {
  reconcileArtespTariffs,
  type ArtespTariffReconcileClient,
  type ArtespTariffReconcileOptions,
  type ArtespTariffReconcileSummary,
} from './artesp-reconcile.js';
import {
  ingestOsmTollPlazas,
  type OsmIngestOptions,
  type OsmIngestSummary,
  type OsmTollPlazaUpsertClient,
} from './osm-toll-plazas.js';

export type OsmArtespReconcileClient = OsmTollPlazaUpsertClient & ArtespTariffReconcileClient;

export interface OsmArtespReconcileOptions {
  readonly osm?: OsmIngestOptions;
  readonly artesp?: ArtespTariffReconcileOptions;
}

export interface OsmArtespReconcileSummary {
  readonly osm: OsmIngestSummary;
  readonly artesp: ArtespTariffReconcileSummary;
}

/** Runs the OSM upserts first, then restores the audited ARTESP precedence. */
export async function ingestOsmAndReconcileArtesp(
  prisma: OsmArtespReconcileClient,
  options: OsmArtespReconcileOptions = {},
): Promise<OsmArtespReconcileSummary> {
  const osm = await ingestOsmTollPlazas(prisma, options.osm);
  const artesp = await reconcileArtespTariffs(prisma, options.artesp);
  return { osm, artesp };
}
