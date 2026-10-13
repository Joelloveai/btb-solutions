-- CreateTable
CREATE TABLE "SiteInstruction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "instructionNumber" TEXT NOT NULL,
    "issuedBy" TEXT NOT NULL,
    "issuedTo" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "attachmentKey" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "issuedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" DATETIME,
    "closedAt" DATETIME,
    "clientRequestId" TEXT,
    CONSTRAINT "SiteInstruction_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rfi" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "rfiNumber" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "raisedBy" TEXT NOT NULL,
    "assignedTo" TEXT,
    "response" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "raisedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" DATETIME,
    "closedAt" DATETIME,
    "attachmentKey" TEXT,
    "clientRequestId" TEXT,
    CONSTRAINT "Rfi_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "SiteInstruction_clientRequestId_key" ON "SiteInstruction"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteInstruction_projectId_instructionNumber_key" ON "SiteInstruction"("projectId", "instructionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Rfi_clientRequestId_key" ON "Rfi"("clientRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Rfi_projectId_rfiNumber_key" ON "Rfi"("projectId", "rfiNumber");

