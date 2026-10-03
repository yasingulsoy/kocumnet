-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastDigestAt" TIMESTAMP(3),
ADD COLUMN     "mailOptOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "mailToken" UUID NOT NULL DEFAULT gen_random_uuid();

-- CreateIndex
CREATE INDEX "CheckupSession_userId_status_submittedAt_idx" ON "CheckupSession"("userId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "LevelRun_userId_status_idx" ON "LevelRun"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "User_mailToken_key" ON "User"("mailToken");

