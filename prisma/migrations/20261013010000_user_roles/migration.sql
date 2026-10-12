-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" DATETIME,
    "phone" TEXT,
    "subcontractorId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "id", "locale", "name", "passwordHash", "phone", "subcontractorId") SELECT "createdAt", "email", "id", "locale", "name", "passwordHash", "phone", "subcontractorId" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


-- Everyone who already signs in to the office app (not a subcontractor) becomes an ADMIN: the existing
-- login keeps full access and is the first administrator.
UPDATE "User" SET "role" = 'ADMIN' WHERE "subcontractorId" IS NULL;
