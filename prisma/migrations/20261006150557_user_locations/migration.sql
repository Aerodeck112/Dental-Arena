-- CreateTable
CREATE TABLE "UserLocation" (
    "userId" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,

    PRIMARY KEY ("userId", "locationId"),
    CONSTRAINT "UserLocation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "UserLocation_locationId_idx" ON "UserLocation"("locationId");

-- Conturile existente: clinica de bază devine clinica bifată; fără clinică de bază = ambele clinici.
INSERT INTO "UserLocation" ("userId", "locationId")
SELECT "id", "homeLocationId" FROM "User" WHERE "homeLocationId" IS NOT NULL;
INSERT INTO "UserLocation" ("userId", "locationId")
SELECT u."id", l."id" FROM "User" u CROSS JOIN "Location" l WHERE u."homeLocationId" IS NULL;
