-- AlterTable
ALTER TABLE "CostEntry" ADD COLUMN "clientRequestId" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "clientRequestId" TEXT;

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN "clientRequestId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CostEntry_clientRequestId_key" ON "CostEntry"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_clientRequestId_key" ON "Payment"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_clientRequestId_key" ON "Photo"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_clientRequestId_key" ON "Task"("clientRequestId");

