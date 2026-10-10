-- CreateEnum
CREATE TYPE "PracticeMode" AS ENUM ('SIMILAR', 'TOPIC');

-- AlterEnum
ALTER TYPE "PackageKind" ADD VALUE 'PRACTICE';

-- AlterEnum
ALTER TYPE "SessionKind" ADD VALUE 'PRACTICE';

-- AlterTable
ALTER TABLE "CheckupSession" ADD COLUMN     "practiceMode" "PracticeMode",
ADD COLUMN     "sourceSessionId" TEXT;

-- AlterTable
ALTER TABLE "SessionItem" ADD COLUMN     "sourceQuestionId" TEXT;

