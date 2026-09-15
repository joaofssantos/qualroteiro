-- F2a: Trip / TripDay / TripItem.
--
-- GENERATED OFFLINE, NEVER APPLIED. Produced by
--   prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- because the Docker daemon was unreachable while this unit was built, so
-- `prisma migrate dev` could not run and no statement below has ever executed
-- against a real PostgreSQL. It is the tool's own output, not hand-written,
-- but it is UNVERIFIED AGAINST A LIVE DATABASE — apply it with that in mind.
-- See apps/api/specs/005-f2a-trips/tasks.md ("Limits").

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "startDate" TEXT,
    "endDate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripDay" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "date" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "TripDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripItem" (
    "id" TEXT NOT NULL,
    "tripDayId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "moduleId" VARCHAR(64) NOT NULL,
    "kind" VARCHAR(64) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "payload" JSONB NOT NULL,
    "costEstimate" DOUBLE PRECISION,

    CONSTRAINT "TripItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE INDEX "TripDay_tripId_idx" ON "TripDay"("tripId");

-- CreateIndex
CREATE INDEX "TripItem_tripDayId_idx" ON "TripItem"("tripDayId");

-- AddForeignKey
ALTER TABLE "TripDay" ADD CONSTRAINT "TripDay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripItem" ADD CONSTRAINT "TripItem_tripDayId_fkey" FOREIGN KEY ("tripDayId") REFERENCES "TripDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

