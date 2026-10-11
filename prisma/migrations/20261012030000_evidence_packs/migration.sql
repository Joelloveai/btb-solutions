-- AlterTable
ALTER TABLE "Project" ADD COLUMN "contractRef" TEXT;

-- CreateTable
CREATE TABLE "EvidencePack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "claimId" TEXT,
    "pdfKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "eventCount" INTEGER NOT NULL,
    "headHash" TEXT,
    "generatedBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidencePack_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "EvidencePack_projectId_createdAt_idx" ON "EvidencePack"("projectId", "createdAt");

