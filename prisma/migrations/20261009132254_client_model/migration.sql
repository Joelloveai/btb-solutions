-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "clientName" TEXT,
    "contractValue" DECIMAL NOT NULL,
    "startDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "sstEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sstRate" DECIMAL NOT NULL DEFAULT 6.00,
    "lastClaimNumber" INTEGER NOT NULL DEFAULT 0,
    "retentionPercent" DECIMAL NOT NULL DEFAULT 5.00,
    "retentionReleased" DECIMAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "clientId" TEXT,
    CONSTRAINT "Project_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("clientName", "contractValue", "createdAt", "id", "lastClaimNumber", "name", "retentionPercent", "retentionReleased", "sstEnabled", "sstRate", "startDate", "status", "updatedAt") SELECT "clientName", "contractValue", "createdAt", "id", "lastClaimNumber", "name", "retentionPercent", "retentionReleased", "sstEnabled", "sstRate", "startDate", "status", "updatedAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
