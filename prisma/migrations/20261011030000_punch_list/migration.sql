-- CreateTable
CREATE TABLE "PunchItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "subcontractorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" DATETIME,
    "photoId" TEXT,
    "resolvedPhotoId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "closedAt" DATETIME,
    "clientRequestId" TEXT,
    CONSTRAINT "PunchItem_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PunchItem_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PunchItem_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PunchItem_resolvedPhotoId_fkey" FOREIGN KEY ("resolvedPhotoId") REFERENCES "Photo" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PunchItem_photoId_key" ON "PunchItem"("photoId");

-- CreateIndex
CREATE UNIQUE INDEX "PunchItem_resolvedPhotoId_key" ON "PunchItem"("resolvedPhotoId");

-- CreateIndex
CREATE UNIQUE INDEX "PunchItem_clientRequestId_key" ON "PunchItem"("clientRequestId");

