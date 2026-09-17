/**
 * Structured logging for this package's jobs. A single JSON line per event,
 * to stdout — "console estruturado é suficiente" (spec), no dedicated audit
 * table.
 *
 * `job` is set per logger (via {@link createLogger}) rather than a single
 * hardcoded value: two independent jobs now share this module — `log`
 * (below) is the pre-existing default, pinned to `'ingest-toll-plazas'`
 * (the ANTT job, unchanged, so its historical log lines don't shift), and
 * `osm-toll-plazas.ts` uses its own logger pinned to
 * `'ingest-toll-plazas-osm'` — otherwise both jobs' log lines would
 * misleadingly claim `job: 'ingest-toll-plazas'` regardless of which one
 * actually ran.
 */

export interface IngestLogFields {
  readonly [key: string]: unknown;
}

export interface JobLogger {
  info(event: string, fields?: IngestLogFields): void;
  error(event: string, fields?: IngestLogFields): void;
}

function emit(job: string, level: 'info' | 'error', event: string, fields: IngestLogFields): void {
  const line = JSON.stringify({
    level,
    job,
    event,
    timestamp: new Date().toISOString(),
    ...fields,
  });
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

/** Builds a logger that stamps every line with the given `job` name. */
export function createLogger(job: string): JobLogger {
  return {
    info: (event: string, fields: IngestLogFields = {}) => emit(job, 'info', event, fields),
    error: (event: string, fields: IngestLogFields = {}) => emit(job, 'error', event, fields),
  };
}

/** The ANTT job's logger — unchanged `job` value from before this module
 * served more than one job. */
export const log = createLogger('ingest-toll-plazas');
