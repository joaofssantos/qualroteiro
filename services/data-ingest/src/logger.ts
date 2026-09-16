/**
 * Structured logging for this job. A single JSON line per event, to stdout —
 * "console estruturado é suficiente" (spec), no dedicated audit table.
 */

export interface IngestLogFields {
  readonly [key: string]: unknown;
}

function emit(level: 'info' | 'error', event: string, fields: IngestLogFields): void {
  const line = JSON.stringify({
    level,
    job: 'ingest-toll-plazas',
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

export const log = {
  info: (event: string, fields: IngestLogFields = {}) => emit('info', event, fields),
  error: (event: string, fields: IngestLogFields = {}) => emit('error', event, fields),
};
