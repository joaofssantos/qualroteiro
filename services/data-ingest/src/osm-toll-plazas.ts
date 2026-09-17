/**
 * `ingest-toll-plazas-osm`'s core logic: download (or accept injected
 * Overpass nodes) -> cluster -> parse tariff -> upsert `source: 'osm'` ->
 * structured log. Same shape as `ingest.ts` (the ANTT job) — no BullMQ/Redis
 * dependency here, so both the on-demand CLI (`cli-osm.ts`) and the
 * scheduled worker (`queue.ts`) call this, and tests exercise it directly
 * against a fake Prisma client and injected Overpass nodes.
 *
 * ## Tag-to-column mapping, and why several columns are honest sentinels
 *
 * A real Overpass sample (957 Brazil-wide `barrier=toll_booth` nodes,
 * 2026-09-17 — see `overpass.ts` and `specs/002-t5-wave3-osm-toll-ingest/`)
 * showed the tag set mappers actually use on these nodes:
 *
 * | Column          | Source tag(s)                         | Real coverage |
 * |-----------------|----------------------------------------|---------------|
 * | `concessionaire`| `operator`                              | 936/957 (98%) |
 * | tariff (`charge`)| `charge`                               | 943/957 (99%) |
 * | `name`          | `tags.name`, else `tags.note`           | 16/957 has `name`; `note` (a free-text lane label, e.g. `"Osasco - 1"`) is far more common |
 * | `highway`       | `tags.ref`                              | 26/957 (3%)   |
 * | `uf`            | `tags['addr:state']` (full name) via `br-states.ts` | 2/957 (0.2%) |
 * | `municipality`  | `tags['addr:city']`                     | 2/957 (0.2%)  |
 * | `km`            | *(none — OSM has no equivalent concept)*| 0/957         |
 *
 * `TollPlazaRecord.highway`/`uf`/`municipality`/`km` are all `NOT NULL`
 * columns (ANTT always supplies them), but OSM's toll-booth nodes mostly do
 * not carry the tags that would populate them accurately. Rather than fake
 * precision with a guess (e.g. reverse-geocoding a state from lat/lng, or
 * inferring a highway ref from the operator's usual corridor), a node
 * missing the relevant tag gets an explicit, documented sentinel —
 * `UNKNOWN_HIGHWAY`/`UNKNOWN_UF`/`UNKNOWN_MUNICIPALITY`/`UNKNOWN_KM` below.
 * `uf`'s sentinel is `'BR'`, which is never a real UF code (no Brazilian
 * state uses it), so it reads unambiguously as "not resolved" rather than a
 * plausible-but-wrong state. This is a deliberate, known V1 limitation
 * (same spirit as `parseOsmCharge` returning `null` rather than guessing at
 * a malformed `charge` tag) — `lat`/`lng`/`tariff` are the fields this
 * ingestion job actually promises to be accurate; the rest are best-effort.
 *
 * ## Clustering, chosen representative, and why `chargeTag` sometimes drops
 *
 * `clusterTollBooths` (Wave 1, `@qualroteiro/tolls`) groups same-operator
 * nodes within 150m into one `TollPlazaCluster`, keyed and located at the
 * smallest-id member. Its `chargeTag` carries ONLY that representative
 * booth's tag — if a cluster's smallest-id lane happens to lack a `charge`
 * tag while another lane in the same cluster has one, this job's tariff for
 * that plaza is `null` (counted in `tariffMissing`), not a value borrowed
 * from a sibling lane. This matches Wave 1's own documented behavior (see
 * `packages/tolls/specs/006-osm-toll-parsing-clustering/plan.md`'s "Notes
 * for ... Wave 3") rather than adding new cross-lane reconciliation logic.
 */

import {
  clusterTollBooths,
  parseOsmCharge,
  type OsmTollBooth,
  type TariffByAxleCategory,
} from '@qualroteiro/tolls';

import { ufFromStateName } from './br-states.js';
import { downloadOsmTollBoothNodes, type OverpassNode } from './overpass.js';
import { createLogger } from './logger.js';

const log = createLogger('ingest-toll-plazas-osm');

/** Explicit "not resolved from OSM" sentinels — see this module's doc-comment. */
const UNKNOWN_HIGHWAY = 'Não informado (OSM)';
const UNKNOWN_UF = 'BR';
const UNKNOWN_MUNICIPALITY = 'Não informado (OSM)';
/** OSM has no corridor-relative km-marker concept at all (unlike ANTT's
 * `km_m` column) — `0` is a placeholder, never meaningful for an OSM row.
 * Not read by `matchTolls`/`toTollPlaza()`'s route-matching path (that's
 * geometry-based, via `lat`/`lng`), so this carries no functional risk. */
const UNKNOWN_KM = 0;

/**
 * One row this job is prepared to write to `TollPlazaRecord`, `source: 'osm'`.
 *
 * `tariff` is an OPTIONAL property (omitted, not `tariff: null`) when no
 * tariff parsed — Prisma's generated `create`/`update` input types for a
 * nullable `Json?` column accept a value or `undefined` ("not provided",
 * which persists as SQL `NULL` on `create`), but NOT a literal `null`
 * (Prisma reserves that for `Prisma.JsonNull`, a distinct sentinel this
 * narrow client interface deliberately avoids depending on — see
 * `specs/002-t5-wave3-osm-toll-ingest/spec.md`). One real consequence,
 * documented as a known V1 limitation: if a cluster's `charge` tag is
 * present on one ingestion run and absent/unparseable on a LATER run for the
 * same natural key, `update`'s `undefined` leaves the previous tariff
 * untouched rather than clearing it — same "stale rather than cleared"
 * limitation shape the ANTT job already documents for `active`.
 */
export interface OsmTollPlazaRecordInput {
  readonly id: string;
  readonly concessionaire: string;
  readonly name: string;
  readonly highway: string;
  readonly uf: string;
  readonly municipality: string;
  readonly km: number;
  readonly lat: number;
  readonly lng: number;
  readonly active: boolean;
  readonly ingestedAt: Date;
  readonly source: 'osm';
  readonly tariff?: TariffByAxleCategory;
}

/** Same narrowing as `ingest.ts`'s `TollPlazaUpsertClient` — a fake in tests,
 * the real generated Prisma Client in production. */
export interface OsmTollPlazaUpsertClient {
  tollPlazaRecord: {
    upsert(args: {
      where: { id: string };
      create: OsmTollPlazaRecordInput;
      update: Omit<OsmTollPlazaRecordInput, 'id'>;
    }): Promise<unknown>;
  };
}

export interface OsmIngestOptions {
  /** Injected raw Overpass nodes, bypassing the network — what tests use. */
  readonly nodes?: readonly OverpassNode[];
  /** Injected "now", stamped as `ingestedAt`. Defaults to `new Date()`. */
  readonly now?: Date;
  /** Forwarded to `clusterTollBooths`; defaults to its own 150m default. */
  readonly radiusMeters?: number;
}

export interface OsmIngestSummary {
  readonly totalNodesRead: number;
  /** Nodes with no (or blank) `operator` tag — cannot be safely clustered
   * (see `clusterTollBooths`'s operator-partitioning), so they are excluded
   * before clustering rather than lumped into one synthetic "unknown
   * operator" group that would wrongly merge unrelated real plazas. */
  readonly skippedNoOperator: number;
  readonly clusters: number;
  readonly upserts: number;
  readonly tariffParsed: number;
  readonly tariffMissing: number;
  readonly errors: number;
  readonly errorDetails: readonly { readonly clusterId: string; readonly reason: string }[];
}

function hasOperatorTag(node: OverpassNode): node is OverpassNode & {
  tags: Record<string, string> & { operator: string };
} {
  const operator = node.tags?.operator;
  return typeof operator === 'string' && operator.trim() !== '';
}

/**
 * Runs one full OSM ingestion pass: download (unless `nodes` is injected),
 * filter to nodes carrying an `operator`, cluster into plaza candidates,
 * parse each cluster's tariff, and `upsert` each one by its natural-key `id`
 * (`osm-<smallest node id>`, already formatted by `clusterTollBooths`) —
 * idempotent by construction: re-running against the same nodes re-upserts
 * the same ids (bumping `ingestedAt`), never inserts a duplicate row. Always
 * writes `source: 'osm'` — this job never touches an `antt`-sourced row
 * (different natural-key namespace: `osm-<id>` vs. the ANTT job's
 * concessionaire/name/highway/km slug), so the two sources coexist without
 * either overwriting the other.
 *
 * A single upsert failure is counted in `errorDetails` and skipped — it does
 * not abort the run, mirroring `ingestTollPlazas`'s per-record error handling.
 */
export async function ingestOsmTollPlazas(
  prisma: OsmTollPlazaUpsertClient,
  options: OsmIngestOptions = {},
): Promise<OsmIngestSummary> {
  const now = options.now ?? new Date();
  const startedAt = Date.now();

  const nodes = options.nodes ?? (await downloadOsmTollBoothNodes());
  const totalNodesRead = nodes.length;

  const withOperator = nodes.filter(hasOperatorTag);
  const skippedNoOperator = totalNodesRead - withOperator.length;

  const tagsById = new Map<number, Record<string, string>>();
  const booths: OsmTollBooth[] = withOperator.map((node) => {
    tagsById.set(node.id, node.tags);
    return {
      id: node.id,
      lat: node.lat,
      lng: node.lon,
      operator: node.tags.operator,
      chargeTag: node.tags.charge,
    };
  });

  const clusters = clusterTollBooths(booths, options.radiusMeters);

  let tariffParsed = 0;
  let tariffMissing = 0;
  let upserts = 0;
  const errorDetails: { clusterId: string; reason: string }[] = [];

  for (const cluster of clusters) {
    const representativeId = cluster.boothIds[0] as number;
    const tags = tagsById.get(representativeId) ?? {};

    const tariff = cluster.chargeTag !== undefined ? parseOsmCharge(cluster.chargeTag) : null;
    if (tariff !== null) {
      tariffParsed++;
    } else {
      tariffMissing++;
    }

    const record: OsmTollPlazaRecordInput = {
      id: cluster.id,
      concessionaire: cluster.operator,
      name: tags.name ?? tags.note ?? `${cluster.operator} (OSM ${representativeId})`,
      highway: tags.ref ?? UNKNOWN_HIGHWAY,
      uf: ufFromStateName(tags['addr:state']) ?? UNKNOWN_UF,
      municipality: tags['addr:city'] ?? UNKNOWN_MUNICIPALITY,
      km: UNKNOWN_KM,
      lat: cluster.lat,
      lng: cluster.lng,
      active: true,
      ingestedAt: now,
      source: 'osm',
      // Omitted (not `null`) when unparsed — see `OsmTollPlazaRecordInput`'s
      // doc-comment for why.
      ...(tariff !== null ? { tariff } : {}),
    };

    try {
      const { id, ...rest } = record;
      await prisma.tollPlazaRecord.upsert({ where: { id }, create: record, update: rest });
      upserts++;
    } catch (err) {
      errorDetails.push({
        clusterId: cluster.id,
        reason: `upsert failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const summary: OsmIngestSummary = {
    totalNodesRead,
    skippedNoOperator,
    clusters: clusters.length,
    upserts,
    tariffParsed,
    tariffMissing,
    errors: errorDetails.length,
    errorDetails,
  };

  log.info('osm-ingest-run-complete', {
    ...summary,
    durationMs: Date.now() - startedAt,
  });

  return summary;
}
