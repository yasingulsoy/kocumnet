-- CreateEnum
CREATE TYPE "PackageKind" AS ENUM ('STANDARD', 'INTRO', 'RETEST');

-- AlterTable
ALTER TABLE "Package" ADD COLUMN     "kind" "PackageKind" NOT NULL DEFAULT 'STANDARD';
