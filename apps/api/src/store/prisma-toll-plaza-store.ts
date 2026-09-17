/**
 * The Prisma implementation of {@link TollPlazaStore}.
 *
 * Constructed only by `src/server.ts`. Both methods are read-only — this
 * unit's write path (the initial upsert of ingested rows) belongs to Wave 3's
 * `services/data-ingest` job, not to `apps/api`.
 */

import type { PrismaClient } from '@prisma/client';

import type {
  TollPlazaRecord,
  TollPlazaSource,
  TollPlazaStatus,
  TollPlazaStore,
} from './toll-plaza-store.js';

export function createPrismaTollPlazaStore(prisma: PrismaClient): TollPlazaStore {
  return {
    async listActive(): Promise<readonly TollPlazaRecord[]> {
      const rows = await prisma.tollPlazaRecord.findMany({ where: { active: true } });
      return rows;
    },

    async status(): Promise<TollPlazaStatus> {
      const [count, mostRecent, bySourceGroups] = await Promise.all([
        prisma.tollPlazaRecord.count(),
        prisma.tollPlazaRecord.findFirst({
          orderBy: { ingestedAt: 'desc' },
          select: { ingestedAt: true },
        }),
        prisma.tollPlazaRecord.groupBy({ by: ['source'], _count: { _all: true } }),
      ]);

      // Always both keys, `0` for a source with no rows yet — see
      // `TollPlazaStatus.bySource`'s doc-comment for why a caller should
      // never have to guard against a missing key.
      const bySource: Record<TollPlazaSource, number> = { antt: 0, osm: 0 };
      for (const group of bySourceGroups) {
        bySource[group.source] = group._count._all;
      }

      return { count, lastIngestedAt: mostRecent?.ingestedAt ?? null, bySource };
    },
  };
}
