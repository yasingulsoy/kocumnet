-- CreateEnum
CREATE TYPE "QuestionLevel" AS ENUM ('L1_TEMEL', 'L2_ORTA', 'L3_ANALIZ');

-- CreateEnum
CREATE TYPE "StageKind" AS ENUM ('MAIN', 'REMEDIAL');

-- CreateEnum
CREATE TYPE "LevelRunStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'STOPPED');

-- AlterEnum
ALTER TYPE "SessionKind" ADD VALUE 'LEVEL_STAGE';

-- AlterTable
ALTER TABLE "CheckupSession" ADD COLUMN     "levelRunId" TEXT,
ADD COLUMN     "stageKind" "StageKind",
ADD COLUMN     "stageLevel" INTEGER;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "level" "QuestionLevel",
ADD COLUMN     "objectiveId" TEXT;

-- CreateTable
CREATE TABLE "Objective" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examScopes" "ExamScope"[] DEFAULT ARRAY[]::"ExamScope"[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "status" "PublishStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Objective_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LevelRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examScope" "ExamScope" NOT NULL,
    "status" "LevelRunStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "stoppedAtLevel" INTEGER,
    "reachedLevel" INTEGER NOT NULL DEFAULT 1,
    "unlockedLevel" INTEGER NOT NULL DEFAULT 1,
    "gateLog" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "LevelRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Objective_code_key" ON "Objective"("code");

-- CreateIndex
CREATE INDEX "Objective_topicId_sortOrder_idx" ON "Objective"("topicId", "sortOrder");

-- CreateIndex
CREATE INDEX "Objective_status_idx" ON "Objective"("status");

-- CreateIndex
CREATE INDEX "LevelRun_userId_startedAt_idx" ON "LevelRun"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "LevelRun_status_idx" ON "LevelRun"("status");

-- CreateIndex
CREATE INDEX "CheckupSession_levelRunId_stageLevel_idx" ON "CheckupSession"("levelRunId", "stageLevel");

-- CreateIndex
CREATE INDEX "Question_objectiveId_level_status_idx" ON "Question"("objectiveId", "level", "status");

-- CreateIndex
CREATE INDEX "Question_level_status_idx" ON "Question"("level", "status");

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckupSession" ADD CONSTRAINT "CheckupSession_levelRunId_fkey" FOREIGN KEY ("levelRunId") REFERENCES "LevelRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Objective" ADD CONSTRAINT "Objective_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LevelRun" ADD CONSTRAINT "LevelRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
