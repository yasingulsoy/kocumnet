-- CreateEnum
CREATE TYPE "SessionEndReason" AS ENUM ('STUDENT', 'TIMEOUT', 'RESTART');

-- AlterTable
ALTER TABLE "CheckupSession" ADD COLUMN     "endedBy" "SessionEndReason",
ADD COLUMN     "perceivedDifficulty" INTEGER;

-- AlterTable
ALTER TABLE "PasswordResetToken" ADD COLUMN     "createdByStaff" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "publishedByStaff" TEXT;

-- AlterTable
ALTER TABLE "StudyGroup" ADD COLUMN     "joinCode" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastSeenAt" TIMESTAMP(3),
ADD COLUMN     "signupSource" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "StudyGroup_joinCode_key" ON "StudyGroup"("joinCode");

