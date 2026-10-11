-- AlterTable
ALTER TABLE "DailyLog" ADD COLUMN "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DailyLog_clientRequestId_key" ON "DailyLog"("clientRequestId");

