-- CreateTable
CREATE TABLE "BoqSection" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "BoqSection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimLineItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "boqLineId" TEXT,
    "description" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "quantity" DECIMAL NOT NULL,
    "rate" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "previousAmount" DECIMAL NOT NULL,
    "currentAmount" DECIMAL NOT NULL,
    CONSTRAINT "ClaimLineItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ClaimLineItem_boqLineId_fkey" FOREIGN KEY ("boqLineId") REFERENCES "BoqLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClaimCertificate" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "claimId" TEXT NOT NULL,
    "certificateNumber" TEXT NOT NULL,
    "certifiedAmount" DECIMAL NOT NULL,
    "certifiedBy" TEXT NOT NULL,
    "certifiedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "remarks" TEXT,
    "pdfKey" TEXT,
    CONSTRAINT "ClaimCertificate_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "Claim" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BoqLine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DECIMAL NOT NULL,
    "unit" TEXT NOT NULL,
    "rate" DECIMAL NOT NULL,
    "amount" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sectionId" TEXT,
    "itemCode" TEXT,
    "completedQuantity" DECIMAL NOT NULL DEFAULT 0,
    "claimedQuantity" DECIMAL NOT NULL DEFAULT 0,
    "remainingQuantity" DECIMAL NOT NULL DEFAULT 0,
    CONSTRAINT "BoqLine_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BoqLine_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "BoqSection" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BoqLine" ("amount", "createdAt", "description", "id", "position", "projectId", "qty", "rate", "unit") SELECT "amount", "createdAt", "description", "id", "position", "projectId", "qty", "rate", "unit" FROM "BoqLine";
DROP TABLE "BoqLine";
ALTER TABLE "new_BoqLine" RENAME TO "BoqLine";
CREATE TABLE "new_ChangeOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "approvedAt" DATETIME,
    "boqLineId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentToClientAt" DATETIME,
    "clientDecision" TEXT,
    "clientDecidedAt" DATETIME,
    "clientDecidedById" TEXT,
    "voNumber" TEXT,
    "voType" TEXT NOT NULL DEFAULT 'ADDITION',
    "submittedBy" TEXT,
    "approvedBy" TEXT,
    "timeExtensionDays" INTEGER,
    "impactOnContractSum" DECIMAL,
    CONSTRAINT "ChangeOrder_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ChangeOrder_boqLineId_fkey" FOREIGN KEY ("boqLineId") REFERENCES "BoqLine" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ChangeOrder" ("amount", "approvedAt", "boqLineId", "clientDecidedAt", "clientDecidedById", "clientDecision", "createdAt", "date", "description", "id", "projectId", "sentToClientAt", "status") SELECT "amount", "approvedAt", "boqLineId", "clientDecidedAt", "clientDecidedById", "clientDecision", "createdAt", "date", "description", "id", "projectId", "sentToClientAt", "status" FROM "ChangeOrder";
DROP TABLE "ChangeOrder";
ALTER TABLE "new_ChangeOrder" RENAME TO "ChangeOrder";
CREATE TABLE "new_Claim" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "workDone" DECIMAL NOT NULL,
    "sstAmount" DECIMAL NOT NULL,
    "amountClaimed" DECIMAL NOT NULL,
    "retentionPercent" DECIMAL NOT NULL,
    "retentionAmount" DECIMAL NOT NULL,
    "previousClaimed" DECIMAL NOT NULL,
    "netClaim" DECIMAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimNumber" TEXT,
    "periodFrom" DATETIME,
    "periodTo" DATETIME,
    "materialsOnSiteAmount" DECIMAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" DATETIME,
    "certifiedAt" DATETIME,
    "paidAt" DATETIME,
    "certifiedBy" TEXT,
    CONSTRAINT "Claim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Claim" ("amountClaimed", "createdAt", "date", "id", "netClaim", "number", "previousClaimed", "projectId", "retentionAmount", "retentionPercent", "sstAmount", "workDone") SELECT "amountClaimed", "createdAt", "date", "id", "netClaim", "number", "previousClaimed", "projectId", "retentionAmount", "retentionPercent", "sstAmount", "workDone" FROM "Claim";
DROP TABLE "Claim";
ALTER TABLE "new_Claim" RENAME TO "Claim";
CREATE UNIQUE INDEX "Claim_projectId_number_key" ON "Claim"("projectId", "number");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Existing BOQ lines start with nothing done: everything is still remaining.
UPDATE "BoqLine" SET "remainingQuantity" = "qty";
-- Existing claims were issued, i.e. submitted.
UPDATE "Claim" SET "status" = 'SUBMITTED', "submittedAt" = "createdAt" WHERE "submittedAt" IS NULL;
-- Existing change orders become VOs in the order they were made, per project.
UPDATE "ChangeOrder" SET "impactOnContractSum" = "amount" WHERE "impactOnContractSum" IS NULL;
