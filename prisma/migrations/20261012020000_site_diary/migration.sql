-- CreateTable
CREATE TABLE "SiteDiary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "weather" TEXT NOT NULL,
    "manpower" TEXT NOT NULL DEFAULT '{}',
    "machinery" TEXT NOT NULL DEFAULT '[]',
    "materialsIn" TEXT NOT NULL DEFAULT '[]',
    "worksDone" TEXT NOT NULL,
    "issues" TEXT,
    "visitorLog" TEXT,
    "status" TEXT NOT NULL DEFAULT 'AWAITING_COUNTERSIGN',
    "preparedById" TEXT NOT NULL,
    "preparedBy" TEXT NOT NULL,
    "preparedAt" DATETIME NOT NULL,
    "preparedSignature" TEXT NOT NULL,
    "preparedSignatureHash" TEXT NOT NULL,
    "verifiedById" TEXT,
    "verifiedBy" TEXT,
    "verifiedAt" DATETIME,
    "verifiedSignature" TEXT,
    "verifiedSignatureHash" TEXT,
    "contentHash" TEXT NOT NULL,
    "pdfKey" TEXT,
    "pdfSha256" TEXT,
    "clientRequestId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SiteDiary_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteDiary_clientRequestId_key" ON "SiteDiary"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteDiary_projectId_date_key" ON "SiteDiary"("projectId", "date");

