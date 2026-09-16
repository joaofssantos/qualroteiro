-- CreateTable
CREATE TABLE "ApiUsageCounter" (
    "sku" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0
);

-- CreateIndex
CREATE UNIQUE INDEX "ApiUsageCounter_sku_yearMonth_key" ON "ApiUsageCounter"("sku", "yearMonth");
