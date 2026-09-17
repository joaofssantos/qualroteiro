# Plan

1. Confirm the real PDF shape BEFORE writing the parser, per orientation.md's
   own instruction and this repo's established pattern (Wave 3 of
   `j-20260916-y9` did the same for Overpass). Downloaded the real PDF
   (2026-09-17, matches orientation.md's own byte count/last-modified
   exactly), inspected it with `pdftotext -layout` (a local, throwaway
   research tool — never a production dependency) to understand the real
   column layout, the CAT-1..9 format, and confirm the "Passeio ==
   Comercial por eixo" finding, before writing a single line of the parser.
2. Confirm the real OSM-side data shape too: queried the live Postgres
   (`localhost:5433`, the real 489 `source: 'osm'` rows from the already-merged
   Wave 3) directly for `highway`/`uf` coverage and `lat`/`lng` range —
   this is what killed the "same rodovia" example filter and replaced it
   with the SP-bbox + fuzzy-name design, BEFORE writing `artesp-match.ts`.
3. `src/artesp-pdf.ts`: prototyped the row-reconstruction algorithm
   (y-clustering + x-gap chunking, then the pending/lookahead state machine)
   against the real extracted text in a throwaway script first, fixing two
   real bugs found this way (a complete row grafting onto its neighbour;
   the reverse — an unrelated header/next-row line leaking into a complete
   row) before porting the validated algorithm into the real TypeScript
   module. `extractArtespPdfLines()` (pdfjs-dist-based) and
   `parseArtespTarifaLines()` (pure, fixture-testable) kept as separate
   exports precisely so the bug-fix cycle above, and every test in
   `tests/artesp-pdf.test.ts`, could iterate without touching a real PDF
   binary.
4. `src/artesp-match.ts`: `normalizePlazaName()`/`stringSimilarity()`
   (Levenshtein, no external dependency), `SP_BBOX`/`isWithinSpBoundingBox()`,
   `matchArtespToOsm()` (bbox filter -> score every in-bbox pair -> greedy
   threshold-cutoff assignment).
5. `src/artesp-compare.ts`: `compareTariffs()` — car/motorcycle direct,
   per-axle-commercial via the "divide OSM's truck_N_axle back down" logic
   (see spec.md's "Design decisions").
6. `src/artesp-audit.ts`: `runArtespAudit()` orchestrator (download+parse or
   injected rows -> read-only Postgres `findMany` -> match -> compare ->
   Markdown report) + `OsmTollPlazaReadClient` narrow interface (mirrors
   `ingest.ts`'s `TollPlazaUpsertClient` pattern, for reads).
7. `src/cli-artesp-audit.ts`: on-demand entrypoint, mirrors `cli.ts`/`cli-osm.ts`
   exactly; writes the Markdown report to `docs/audits/artesp-tariff-audit.md`
   by default (overridable via `argv[1]`).
8. `src/index.ts` + `package.json` + `tsconfig.json`: export the new
   surface, add the `pdfjs-dist` dependency and `audit:artesp:once` script,
   add `DOM` to this package's own `lib` (see spec.md — needed for
   `pdfjs-dist`'s shipped types to resolve under `skipLibCheck: true`).
9. Build `@qualroteiro/geo` then `@qualroteiro/tolls` first (unbuilt
   workspace dependencies' `dist`) before this package's own
   typecheck/test — same precedent `specs/002-t5-wave3-osm-toll-ingest/plan.md`
   already documents.
10. Run the real CLI once against the real Postgres (`localhost:5433`) —
    confirmed Wave 3 of `j-20260916-y9` is `merged` in `origin/main` first
    (a hard precondition per orientation.md's Sequencing section) — and
    commit the real report as evidence.
