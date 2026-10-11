-- AlterTable
ALTER TABLE "TimelineEvent" ADD COLUMN "clientRequestId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "TimelineEvent_clientRequestId_key" ON "TimelineEvent"("clientRequestId");

