/**
 * Downloads the official ANTT toll-plaza CSV and decodes it to text.
 *
 * The CSV resource (not the JSON one — the CSV is what the coordinator
 * confirmed and specified the exact columns for) from ANTT's open-data
 * portal, updated monthly:
 * `dados.antt.gov.br/dataset/a7e1e12d-f8e8-40cd-bc1f-57973a4a4a6d`
 * ("Praça de Pedágio").
 */

import { decodeAnttCsvBytes } from './decode.js';

export const ANTT_TOLL_PLAZA_CSV_URL =
  'https://dados.antt.gov.br/dataset/a7e1e12d-f8e8-40cd-bc1f-57973a4a4a6d/resource/9aa29243-c54c-4084-bc3d-c44a75c9bd7e/download/dados-dos-pracas-de-pedagio6_2026.csv';

/**
 * @param fetchImpl Injectable for tests; defaults to global `fetch` (built
 *   into Node 20+, same pattern as `apps/api/src/providers/*`).
 */
export async function downloadAnttTollPlazaCsv(
  url: string = ANTT_TOLL_PLAZA_CSV_URL,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error(`ANTT CSV download failed: HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  return decodeAnttCsvBytes(bytes);
}
