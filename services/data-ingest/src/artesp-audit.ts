/**
 * Orchestrates the ARTESP tariff audit: download + parse the official PDF
 * (`artesp-pdf.ts`), read every `source: 'osm'` `TollPlazaRecord` from
 * Postgres (read-only — this job never writes to that table, per
 * `.aipe/journeys/j-20260916-x3/orientation.md`'s decision that this is an
 * audit/report, not a new ingestion source), match the two
 * (`artesp-match.ts`), compare tariffs per match (`artesp-compare.ts`), and
 * render a Markdown report.
 *
 * No BullMQ/Redis dependency, no scheduling — `cli-artesp-audit.ts` is the
 * only entrypoint, same "on-demand only" shape orientation.md asked for.
 */

import {
  matchArtespToOsm,
  type ArtespMatchResult,
  type MatchOptions,
  type OsmTollPlazaCandidate,
} from './artesp-match.js';
import {
  compareTariffs,
  DEFAULT_DIVERGENCE_THRESHOLD,
  type DivergenceThreshold,
  type PlazaTariffComparison,
} from './artesp-compare.js';
import {
  downloadAndParseArtespTarifas,
  type ArtespParseResult,
  type ArtespTollRow,
} from './artesp-pdf.js';
import { createLogger } from './logger.js';

const log = createLogger('audit-artesp-tariffs');

/**
 * Narrow read-only client shape this job needs — a fake in tests, the real
 * generated Prisma Client in production (same "narrow interface" pattern as
 * `ingest.ts`'s `TollPlazaUpsertClient`, mirrored for reads instead of
 * writes).
 */
export interface OsmTollPlazaReadClient {
  tollPlazaRecord: {
    findMany(args: {
      where: { source: 'osm' };
      select: {
        id: true;
        concessionaire: true;
        name: true;
        lat: true;
        lng: true;
        tariff: true;
      };
    }): Promise<
      readonly {
        readonly id: string;
        readonly concessionaire: string;
        readonly name: string;
        readonly lat: number;
        readonly lng: number;
        readonly tariff: unknown;
      }[]
    >;
  };
}

export interface ArtespAuditOptions extends MatchOptions {
  /** Injected, already-parsed ARTESP rows — what tests use, bypassing the
   * network/PDF parsing entirely. When omitted, the real PDF is downloaded
   * and parsed. */
  readonly artespParseResult?: ArtespParseResult;
  readonly pdfUrl?: string;
  readonly fetchImpl?: typeof fetch;
  readonly divergenceThreshold?: DivergenceThreshold;
  /** Injected "now", stamped into the report header. Defaults to `new Date()`. */
  readonly now?: Date;
}

export interface ArtespAuditSummary {
  readonly generatedAt: string;
  readonly totalArtespRows: number;
  readonly excludedCatFormatCount: number;
  readonly totalOsmSourceRows: number;
  readonly osmOutsideSpBoundingBox: number;
  readonly matchedCount: number;
  readonly matchedOkCount: number;
  readonly matchedDivergingCount: number;
  readonly matchedNoOsmTariffCount: number;
  readonly artespUnmatchedCount: number;
  readonly osmUnmatchedCount: number;
}

export interface ArtespAuditResult {
  readonly summary: ArtespAuditSummary;
  readonly matchResult: ArtespMatchResult;
  readonly comparisons: ReadonlyMap<string, PlazaTariffComparison>;
  readonly reportMarkdown: string;
}

/** `TollPlazaRecord.tariff` is a Prisma `Json?` column — validated shallowly
 * here (an object with numeric `car`) before being trusted, same spirit as
 * `apps/api`'s `toTollPlaza()` (see `apps/api/prisma/schema.prisma`'s
 * `tariff` doc-comment) rather than casting blindly. Anything that doesn't
 * look right becomes `null` (treated identically to "OSM has no tariff for
 * this plaza"), never thrown. */
function readTariffJson(raw: unknown): OsmTollPlazaCandidate['tariff'] {
  if (raw === null || typeof raw !== 'object') return null;
  const value = raw as Record<string, unknown>;
  if (typeof value.car !== 'number') return null;
  return value as unknown as OsmTollPlazaCandidate['tariff'];
}

function formatBrl(value: number | undefined): string {
  if (value === undefined) return '—';
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return '—';
  return `${value.toFixed(1)}%`;
}

const CATEGORY_LABEL: Record<string, string> = {
  car: 'Passeio (car)',
  motorcycle: 'Motos',
  per_axle_commercial: 'Comercial por eixo (per-axle)',
};

function renderComparisonRow(plazaLabel: string, comparison: PlazaTariffComparison): string[] {
  return comparison.comparisons
    .filter((c) => c.osmValue !== undefined)
    .map((c) => {
      const label = CATEGORY_LABEL[c.category] ?? c.category;
      const flag = c.diverges ? '⚠️ diverge' : '✅ bate';
      return `| ${plazaLabel} | ${label} | ${formatBrl(c.artespValue)} | ${formatBrl(c.osmValue)} | ${formatBrl(c.absoluteDiff)} | ${formatPercent(c.percentDiff)} | ${flag} |`;
    });
}

function buildMarkdownReport(
  summary: ArtespAuditSummary,
  matchResult: ArtespMatchResult,
  comparisons: ReadonlyMap<string, PlazaTariffComparison>,
  divergenceThreshold: DivergenceThreshold,
): string {
  const lines: string[] = [];
  lines.push('# Auditoria ARTESP x OSM — tarifas de pedágio (rodovias estaduais de SP)');
  lines.push('');
  lines.push(`Gerado em: ${summary.generatedAt}`);
  lines.push('');
  lines.push(
    `Limiar de divergência: > R$ ${divergenceThreshold.absoluteBrl.toFixed(2)} OU > ${(divergenceThreshold.percent * 100).toFixed(0)}% (o que for mais sensível no valor em questão).`,
  );
  lines.push('');
  lines.push('## Resumo');
  lines.push('');
  lines.push(`- Praças ARTESP (formato simples, parseadas): ${summary.totalArtespRows}`);
  lines.push(
    `- Praças ARTESP excluídas (formato CAT-1..9, fora do parser V1): ${summary.excludedCatFormatCount}`,
  );
  lines.push(`- Praças OSM (\`source: 'osm'\`) no Postgres: ${summary.totalOsmSourceRows}`);
  lines.push(
    `- Praças OSM fora da bounding box de SP (descartadas antes do matching): ${summary.osmOutsideSpBoundingBox}`,
  );
  lines.push(`- Pares casados (ARTESP ↔ OSM): ${summary.matchedCount}`);
  lines.push(`  - Bate (dentro do limiar, em todas as categorias comparáveis): ${summary.matchedOkCount}`);
  lines.push(`  - Diverge (pelo menos uma categoria acima do limiar): ${summary.matchedDivergingCount}`);
  lines.push(
    `  - Casados mas sem tarifa OSM para comparar (\`charge\` não parseado): ${summary.matchedNoOsmTariffCount}`,
  );
  lines.push(`- ARTESP sem match OSM: ${summary.artespUnmatchedCount}`);
  lines.push(`- OSM (dentro da bbox de SP) sem match ARTESP: ${summary.osmUnmatchedCount}`);
  lines.push('');

  lines.push('## Praças que divergem');
  lines.push('');
  lines.push('| Praça ARTESP | Categoria | ARTESP | OSM | Diferença | % | Status |');
  lines.push('|---|---|---|---|---|---|---|');
  let anyDiverging = false;
  for (const match of matchResult.matches) {
    const comparison = comparisons.get(match.artesp.id);
    if (!comparison || comparison.overallDiverges !== true) continue;
    anyDiverging = true;
    const label = `${match.artesp.roadCode} / ${match.artesp.plazaName} (OSM: ${match.osm.name})`;
    for (const row of renderComparisonRow(label, comparison)) lines.push(row);
  }
  if (!anyDiverging) lines.push('| _nenhuma_ | | | | | | |');
  lines.push('');

  lines.push('## Praças que batem');
  lines.push('');
  lines.push('| Praça ARTESP | Categoria | ARTESP | OSM | Diferença | % | Status |');
  lines.push('|---|---|---|---|---|---|---|');
  let anyOk = false;
  for (const match of matchResult.matches) {
    const comparison = comparisons.get(match.artesp.id);
    if (!comparison || comparison.overallDiverges !== false) continue;
    anyOk = true;
    const label = `${match.artesp.roadCode} / ${match.artesp.plazaName} (OSM: ${match.osm.name})`;
    for (const row of renderComparisonRow(label, comparison)) lines.push(row);
  }
  if (!anyOk) lines.push('| _nenhuma_ | | | | | | |');
  lines.push('');

  lines.push('## Casados sem tarifa OSM para comparar');
  lines.push('');
  lines.push('| Praça ARTESP | OSM (id) | Score do match |');
  lines.push('|---|---|---|');
  let anyNoTariff = false;
  for (const match of matchResult.matches) {
    const comparison = comparisons.get(match.artesp.id);
    if (!comparison || comparison.overallDiverges !== undefined) continue;
    anyNoTariff = true;
    lines.push(
      `| ${match.artesp.roadCode} / ${match.artesp.plazaName} | ${match.osm.name} (\`${match.osm.id}\`) | ${match.score.toFixed(2)} |`,
    );
  }
  if (!anyNoTariff) lines.push('| _nenhuma_ | | |');
  lines.push('');

  lines.push('## ARTESP sem match OSM');
  lines.push('');
  lines.push('| Rodovia | Praça | KM | Passeio | Comercial por eixo |');
  lines.push('|---|---|---|---|---|');
  if (matchResult.unmatchedArtesp.length === 0) lines.push('| _nenhuma_ | | | | |');
  for (const row of matchResult.unmatchedArtesp) {
    lines.push(
      `| ${row.roadCode} | ${row.plazaName} | ${row.kmRaw} | ${formatBrl(row.tariffPasseio)} | ${formatBrl(row.tariffComercialPorEixo)} |`,
    );
  }
  lines.push('');

  lines.push('## OSM (dentro da bbox de SP) sem match ARTESP');
  lines.push('');
  lines.push('| Concessionária | Nome OSM | id |');
  lines.push('|---|---|---|');
  if (matchResult.unmatchedOsm.length === 0) lines.push('| _nenhuma_ | | |');
  for (const candidate of matchResult.unmatchedOsm) {
    lines.push(`| ${candidate.concessionaire} | ${candidate.name} | \`${candidate.id}\` |`);
  }
  lines.push('');

  return lines.join('\n');
}

/**
 * Runs one full audit pass. `prisma` is read-only (`findMany` only) — never
 * writes `TollPlazaRecord`, per this journey's explicit scope.
 */
export async function runArtespAudit(
  prisma: OsmTollPlazaReadClient,
  options: ArtespAuditOptions = {},
): Promise<ArtespAuditResult> {
  const now = options.now ?? new Date();
  const divergenceThreshold = options.divergenceThreshold ?? DEFAULT_DIVERGENCE_THRESHOLD;

  log.info('audit-run-started');

  const artespParseResult =
    options.artespParseResult ??
    (await downloadAndParseArtespTarifas(options.pdfUrl, options.fetchImpl));

  const osmRows = await prisma.tollPlazaRecord.findMany({
    where: { source: 'osm' },
    select: { id: true, concessionaire: true, name: true, lat: true, lng: true, tariff: true },
  });

  const osmCandidates: OsmTollPlazaCandidate[] = osmRows.map((row) => ({
    id: row.id,
    concessionaire: row.concessionaire,
    name: row.name,
    lat: row.lat,
    lng: row.lng,
    tariff: readTariffJson(row.tariff),
  }));

  const matchResult = matchArtespToOsm(artespParseResult.rows, osmCandidates, {
    scoreThreshold: options.scoreThreshold,
  });

  const comparisons = new Map<string, PlazaTariffComparison>();
  let matchedOkCount = 0;
  let matchedDivergingCount = 0;
  let matchedNoOsmTariffCount = 0;
  for (const match of matchResult.matches) {
    const comparison = compareTariffs(match.artesp, match.osm.tariff, divergenceThreshold);
    comparisons.set(match.artesp.id, comparison);
    if (comparison.overallDiverges === true) matchedDivergingCount++;
    else if (comparison.overallDiverges === false) matchedOkCount++;
    else matchedNoOsmTariffCount++;
  }

  const summary: ArtespAuditSummary = {
    generatedAt: now.toISOString(),
    totalArtespRows: artespParseResult.rows.length,
    excludedCatFormatCount: artespParseResult.excludedCatFormatCount,
    totalOsmSourceRows: osmRows.length,
    osmOutsideSpBoundingBox: matchResult.osmOutsideSpBoundingBox,
    matchedCount: matchResult.matches.length,
    matchedOkCount,
    matchedDivergingCount,
    matchedNoOsmTariffCount,
    artespUnmatchedCount: matchResult.unmatchedArtesp.length,
    osmUnmatchedCount: matchResult.unmatchedOsm.length,
  };

  const reportMarkdown = buildMarkdownReport(summary, matchResult, comparisons, divergenceThreshold);

  log.info('audit-run-finished', { ...summary });

  return { summary, matchResult, comparisons, reportMarkdown };
}

export type { ArtespTollRow };
