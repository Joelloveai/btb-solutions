-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameKey" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trade" TEXT,
    "version" INTEGER NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "note" TEXT,
    "uploadedById" TEXT,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clientRequestId" TEXT,
    CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Document_clientRequestId_key" ON "Document"("clientRequestId");

-- CreateIndex
CREATE INDEX "Document_projectId_isCurrent_idx" ON "Document"("projectId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "Document_projectId_nameKey_version_key" ON "Document"("projectId", "nameKey", "version");

