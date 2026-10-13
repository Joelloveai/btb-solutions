-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME NOT NULL,
    "completedDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "weightagePercent" DECIMAL NOT NULL DEFAULT 0,
    "paymentTrigger" BOOLEAN NOT NULL DEFAULT false,
    "paymentAmount" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectTeamMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectTeamMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectTeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contractRef" TEXT,
    "clientName" TEXT,
    "contractValue" DECIMAL NOT NULL,
    "startDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sstEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sstRate" DECIMAL NOT NULL DEFAULT 6.00,
    "lastClaimNumber" INTEGER NOT NULL DEFAULT 0,
    "retentionPercent" DECIMAL NOT NULL DEFAULT 5.00,
    "retentionReleased" DECIMAL NOT NULL DEFAULT 0,
    "projectType" TEXT,
    "contractType" TEXT,
    "cidbGrade" TEXT,
    "cidbProjectRef" TEXT,
    "architectName" TEXT,
    "engineerName" TEXT,
    "consultantName" TEXT,
    "siteAddress" TEXT,
    "siteLatitude" REAL,
    "siteLongitude" REAL,
    "contractEndDate" DATETIME,
    "defectsLiabilityPeriodDays" INTEGER NOT NULL DEFAULT 365,
    "retentionReleasePercent" DECIMAL NOT NULL DEFAULT 2.50,
    "performanceBondPercent" DECIMAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT,
    "stage" TEXT,
    CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("clientId", "clientName", "contractRef", "contractValue", "createdAt", "id", "lastClaimNumber", "name", "retentionPercent", "retentionReleased", "sstEnabled", "sstRate", "stage", "startDate", "status", "updatedAt") SELECT "clientId", "clientName", "contractRef", "contractValue", "createdAt", "id", "lastClaimNumber", "name", "retentionPercent", "retentionReleased", "sstEnabled", "sstRate", "stage", "startDate", "status", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Milestone_projectId_dueDate_idx" ON "Milestone"("projectId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTeamMember_projectId_userId_key" ON "ProjectTeamMember"("projectId", "userId");

