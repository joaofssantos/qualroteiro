-- CreateEnum
CREATE TYPE "TollPlazaSource" AS ENUM ('antt', 'osm');

-- AlterTable
ALTER TABLE "TollPlazaRecord" ADD COLUMN     "source" "TollPlazaSource" NOT NULL DEFAULT 'antt',
ADD COLUMN     "tariff" JSONB;
