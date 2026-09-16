/**
 * The Prisma implementation of {@link TollPlazaStore}.
 *
 * Constructed only by `src/server.ts`. Both methods are read-only — this
 * unit's write path (the initial upsert of ingested rows) belongs to Wave 3's
 * `services/data-ingest` job, not to `apps/api`.
 */

import type { PrismaClient } from '@prisma/client';

import type { TollPlazaRecord, TollPlazaStatus, TollPlazaStore } from './toll-plaza-store.js';

export function createPrismaTollPlazaStore(prisma: PrismaClient): TollPlazaStore {
  return {
    async listActive(): Promise<readonly TollPlazaRecord[]> {
      const rows = await prisma.tollPlazaRecord.findMany({ where: { active: true } });
      return rows;
    },

    async status(): Promise<TollPlazaStatus> {
      const [count, mostRecent] = await Promise.all([
        prisma.tollPlazaRecord.count(),
        prisma.tollPlazaRecord.findFirst({
          orderBy: { ingestedAt: 'desc' },
          select: { ingestedAt: true },
        }),
      ]);

      return { count, lastIngestedAt: mostRecent?.ingestedAt ?? null };
    },
  };
}
