-- AlterTable
ALTER TABLE "LevelRun" ADD COLUMN     "pendingRemedialIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
