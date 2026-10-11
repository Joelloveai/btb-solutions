-- AlterTable
ALTER TABLE "ChangeOrder" ADD COLUMN "clientDecidedAt" DATETIME;
ALTER TABLE "ChangeOrder" ADD COLUMN "clientDecidedById" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN "clientDecision" TEXT;
ALTER TABLE "ChangeOrder" ADD COLUMN "sentToClientAt" DATETIME;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN "stage" TEXT;

-- CreateTable
CREATE TABLE "Selection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "photoId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "approvedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientRequestId" TEXT,
    CONSTRAINT "Selection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Selection_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PaymentMilestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "percent" DECIMAL NOT NULL,
    "dueDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentMilestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Selection_photoId_key" ON "Selection"("photoId");

-- CreateIndex
CREATE UNIQUE INDEX "Selection_clientRequestId_key" ON "Selection"("clientRequestId");

-- CreateIndex
CREATE INDEX "DailyLog_projectId_date_idx" ON "DailyLog"("projectId", "date");

