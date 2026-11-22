/**
 * Applies ARTESP's official state-highway tariff table to OSM plazas that
 * have been matched with high confidence by the audit.
 *
 * OSM is still the source of geometry/identity.  ARTESP wins only for the
 * fare columns of the twelve conventional plazas listed below: its PDF is
 * the regulator's current tariff source, while OSM's `charge` tags are
 * community maintained and may lag a reajuste.  The eight Free Flow rows are
 * deliberately not written: their name-only OSM match is a different plaza
 * (or no physical booth at all), so copying a fare to it would be worse than
 * retaining the missing match.
 */

import { AXLE_CATEGORIES, type TariffByAxleCategory } from '@qualroteiro/tolls';

import { matchArtespToOsm, type OsmTollPlazaCandidate } from './artesp-match.js';
import type { ArtespParseResult, ArtespTollRow } from './artesp-pdf.js';
import { downloadAndParseArtespTarifas } from './artesp-pdf.js';
import { ARTESP_FREE_FLOW_RECORDS } from './artesp-free-flow.js';

/** Explicit audit findings, kept narrow so a future Free Flow plaza is never
 * silently discarded merely because its name happens to contain "Pórtico". */
const NON_COMPARABLE_FREE_FLOW = new Set([
  'SP-340|Pórtico Santo Antônio de Posse',
  'SP-332|Pórtico Engº Coelho (PaP)',
  'SP-332|Paulínia Jd. Betel (PaP)',
  'SP-075|Pórtico Bloqueio Indaiatuba (PaP)',
  'SP-075|Pórtico Itu 1 (PaP)',
  'SP-021|PRAÇA 2 - TRECHO SUL / IMIGRANTES (Pista Externa)',
  'SP-021|PRAÇA 3 - TRECHO SUL / IMIGRANTES (Pista Externa)',
  'SP-360|Pórtico Jundiaí (PaP)',
]);

export type ArtespReconciliationCause = 'artesp-precedence' | 'free-flow-wrong-osm-match';

export interface ArtespTariffResolution {
  readonly artespId: string;
  readonly osmId: string;
  readonly cause: ArtespReconciliationCause;
}

export function isNonComparableFreeFlow(row: Pick<ArtespTollRow, 'roadCode' | 'plazaName'>): boolean {
  return NON_COMPARABLE_FREE_FLOW.has(`${row.roadCode}|${row.plazaName}`);
}

/** Replaces only values ARTESP actually publishes.  When ARTESP has no motos
 * column, preserve the independently tagged OSM motorcycle value. */
export function tariffFromArtesp(
  row: Pick<ArtespTollRow, 'tariffPasseio' | 'tariffComercialPorEixo' | 'tariffMotos'>,
  osmTariff: TariffByAxleCategory,
): TariffByAxleCategory {
  const perAxle = row.tariffComercialPorEixo;
  return {
    motorcycle: row.tariffMotos ?? osmTariff.motorcycle,
    car: row.tariffPasseio,
    car_with_trailer: row.tariffPasseio,
    truck_2_axle: perAxle * 2,
    truck_3_axle: perAxle * 3,
    truck_4_axle: perAxle * 4,
    truck_5_axle: perAxle * 5,
    truck_6_axle: perAxle * 6,
  };
}

/** Classifies every matched pair; callers only persist `artesp-precedence`.
 * Exported as a pure function so the 20 audited cases stay regression-tested
 * without requiring a database or a PDF download. */
export function resolveArtespTariffs(
  parsed: ArtespParseResult,
  osmCandidates: readonly OsmTollPlazaCandidate[],
): readonly ArtespTariffResolution[] {
  return matchArtespToOsm(parsed.rows, osmCandidates).matches.map((match) => ({
    artespId: match.artesp.id,
    osmId: match.osm.id,
    cause: isNonComparableFreeFlow(match.artesp)
      ? 'free-flow-wrong-osm-match'
      : 'artesp-precedence',
  }));
}

/** Narrow Prisma shape for the actual reconciliation write.  It updates an
 * already-ingested OSM row in place; it never inserts a hand-maintained DB
 * record and therefore remains safe to rerun after OSM ingestion. */
export interface ArtespTariffReconcileClient {
  tollPlazaRecord: {
    findMany(args: {
      where: { source: 'osm' };
      select: { id: true; concessionaire: true; name: true; lat: true; lng: true; tariff: true };
    }): Promise<readonly { id: string; concessionaire: string; name: string; lat: number; lng: number; tariff: unknown }[]>;
    update(args: { where: { id: string }; data: { tariff: TariffByAxleCategory; ingestedAt: Date } }): Promise<unknown>;
    upsert(args: { where: { id: string }; create: { id: string; concessionaire: string; name: string; highway: string; uf: string; municipality: string; km: number; lat: number; lng: number; active: boolean; ingestedAt: Date; source: 'artesp'; tariff: TariffByAxleCategory }; update: Omit<{ id: string; concessionaire: string; name: string; highway: string; uf: string; municipality: string; km: number; lat: number; lng: number; active: boolean; ingestedAt: Date; source: 'artesp'; tariff: TariffByAxleCategory }, 'id'> }): Promise<unknown>;
  };
}

export interface ArtespTariffReconcileOptions {
  readonly artespParseResult?: ArtespParseResult;
  readonly now?: Date;
  readonly fetchImpl?: typeof fetch;
}

export interface ArtespTariffReconcileSummary {
  readonly matched: number;
  readonly overridden: number;
  readonly excludedFreeFlow: number;
  readonly skippedMissingOsmTariff: number;
  readonly freeFlowUpserts: number;
}

function asTariff(raw: unknown): TariffByAxleCategory | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (!AXLE_CATEGORIES.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key]))) return null;
  return value as TariffByAxleCategory;
}

/** Downloads (or accepts) ARTESP's current table and persistently gives it
 * precedence for the audited conventional plazas.  The caller is an
 * ingestion job, not an operator editing Postgres by hand. */
export async function reconcileArtespTariffs(
  prisma: ArtespTariffReconcileClient,
  options: ArtespTariffReconcileOptions = {},
): Promise<ArtespTariffReconcileSummary> {
  const parsed = options.artespParseResult ?? await downloadAndParseArtespTarifas(undefined, options.fetchImpl);
  const rows = await prisma.tollPlazaRecord.findMany({
    where: { source: 'osm' },
    select: { id: true, concessionaire: true, name: true, lat: true, lng: true, tariff: true },
  });
  const candidates: OsmTollPlazaCandidate[] = rows.map((record) => ({
    ...record,
    tariff: asTariff(record.tariff),
  }));
  const matches = matchArtespToOsm(parsed.rows, candidates).matches;
  let overridden = 0;
  let excludedFreeFlow = 0;
  let skippedMissingOsmTariff = 0;
  const now = options.now ?? new Date();
  for (const record of ARTESP_FREE_FLOW_RECORDS) {
    const { id, ...data } = record;
    await prisma.tollPlazaRecord.upsert({ where: { id }, create: { id, ...data, uf: 'SP', municipality: 'Não informado (ARTESP)', active: true, ingestedAt: now, source: 'artesp' }, update: { ...data, uf: 'SP', municipality: 'Não informado (ARTESP)', active: true, ingestedAt: now, source: 'artesp' } });
  }
  for (const match of matches) {
    if (isNonComparableFreeFlow(match.artesp)) {
      excludedFreeFlow++;
      continue;
    }
    if (match.osm.tariff === null) {
      skippedMissingOsmTariff++;
      continue;
    }
    await prisma.tollPlazaRecord.update({
      where: { id: match.osm.id },
      data: { tariff: tariffFromArtesp(match.artesp, match.osm.tariff), ingestedAt: now },
    });
    overridden++;
  }
  return { matched: matches.length, overridden, excludedFreeFlow, skippedMissingOsmTariff, freeFlowUpserts: ARTESP_FREE_FLOW_RECORDS.length };
}
