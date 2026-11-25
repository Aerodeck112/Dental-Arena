-- CreateTable
CREATE TABLE "SiteImage" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "path" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "updatedById" TEXT,
    "updatedAt" DATETIME NOT NULL
);
