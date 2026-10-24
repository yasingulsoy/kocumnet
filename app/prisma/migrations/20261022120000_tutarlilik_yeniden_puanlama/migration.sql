-- AlterEnum
ALTER TYPE "LevelRunStatus" ADD VALUE 'ABANDONED';

-- AlterTable
ALTER TABLE "CheckupResult" ADD COLUMN     "rescoreNote" JSONB,
ADD COLUMN     "rescoredAt" TIMESTAMP(3);

