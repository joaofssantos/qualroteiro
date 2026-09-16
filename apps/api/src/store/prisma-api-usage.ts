/**
 * The Prisma implementation of {@link ApiUsageStore}.
 *
 * Constructed only by `src/server.ts`. `increment` is a single `upsert` with
 * `count: { increment: 1 }` — never a read-then-write — so two concurrent
 * requests in the same month cannot both read the same count and each apply
 * "+1" on top of it, undercounting real calls to Google.
 */

import type { PrismaClient } from '@prisma/client';

import type { ApiUsageStore, UsageCounterSnapshot } from './api-usage.js';

export function createPrismaApiUsageStore(prisma: PrismaClient): ApiUsageStore {
  return {
    async getCount(sku: string, yearMonth: string): Promise<number> {
      const row = await prisma.apiUsageCounter.findUnique({
        where: { sku_yearMonth: { sku, yearMonth } },
      });
      return row?.count ?? 0;
    },

    async increment(sku: string, yearMonth: string): Promise<UsageCounterSnapshot> {
      const row = await prisma.apiUsageCounter.upsert({
        where: { sku_yearMonth: { sku, yearMonth } },
        create: { sku, yearMonth, count: 1 },
        update: { count: { increment: 1 } },
      });
      return { sku: row.sku, yearMonth: row.yearMonth, count: row.count };
    },

    async listAll(): Promise<readonly UsageCounterSnapshot[]> {
      const rows = await prisma.apiUsageCounter.findMany({
        orderBy: [{ sku: 'asc' }, { yearMonth: 'asc' }],
      });
      return rows.map((row) => ({ sku: row.sku, yearMonth: row.yearMonth, count: row.count }));
    },
  };
}
