-- CreateTable
CREATE TABLE "TollPlazaRecord" (
    "id" TEXT NOT NULL,
    "concessionaire" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "highway" TEXT NOT NULL,
    "uf" VARCHAR(2) NOT NULL,
    "municipality" TEXT NOT NULL,
    "km" DOUBLE PRECISION NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "active" BOOLEAN NOT NULL,
    "ingestedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TollPlazaRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TollPlazaRecord_active_idx" ON "TollPlazaRecord"("active");
