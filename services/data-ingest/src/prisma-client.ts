/**
 * The Prisma Client this job writes through.
 *
 * `services/data-ingest` does NOT define its own Prisma schema — one schema,
 * `apps/api/prisma/schema.prisma`, is the single source of truth for the
 * database (see that file's `TollPlazaRecord` doc-comment). This package's
 * `prisma:generate`/`postinstall` script
 * (`prisma generate --schema=../../apps/api/prisma/schema.prisma`) points
 * the CLI at that schema file for which models to read, while `@prisma/client`
 * and `prisma` are pinned here to the EXACT SAME versions `apps/api` uses
 * (`^5.20.0`, both). That pin is what makes this work cleanly: pnpm's
 * content-addressable store resolves both packages' identical
 * `@prisma/client`+`prisma` dependency pair to one shared physical
 * directory (`node_modules/.pnpm/@prisma+client@.../node_modules/@prisma/client`),
 * so `prisma generate` run from EITHER package writes the client to that
 * one shared location, and both packages' `node_modules/@prisma/client`
 * resolve to it — confirmed empirically (`pnpm install`'s postinstall
 * output logs the identical destination path for both `apps/api` and
 * `services/data-ingest`). One generated client, typed from one schema, no
 * second source of truth. If the pinned versions ever drift apart, pnpm
 * would instead give each package its own physical copy — still correct
 * (both still read the same schema file), just duplicated on disk.
 *
 * Import `@prisma/client` here, not construct `new PrismaClient()` at every
 * call site, so tests can inject a fake that only implements the
 * `TollPlazaUpsertClient` shape `ingest.ts` actually needs.
 */

import { PrismaClient } from '@prisma/client';

let singleton: PrismaClient | undefined;

/** Lazily constructs (once) and returns the real Prisma Client. */
export function getPrismaClient(): PrismaClient {
  singleton ??= new PrismaClient();
  return singleton;
}

export async function disconnectPrismaClient(): Promise<void> {
  if (singleton) {
    await singleton.$disconnect();
    singleton = undefined;
  }
}
