-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('PACKAGE', 'TOPIC_RETEST');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PlanItemKind" AS ENUM ('STUDY', 'SOLVE', 'REVIEW', 'RETEST');

-- AlterTable
ALTER TABLE "CheckupResult" ADD COLUMN     "examScope" "ExamScope";

-- AlterTable
ALTER TABLE "CheckupSession" ADD COLUMN     "focusTopicId" TEXT,
ADD COLUMN     "kind" "SessionKind" NOT NULL DEFAULT 'PACKAGE',
ADD COLUMN     "relaxedExposureCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "examScopes" "ExamScope"[] DEFAULT ARRAY[]::"ExamScope"[];

-- AlterTable
ALTER TABLE "Topic" ADD COLUMN     "examScopes" "ExamScope"[] DEFAULT ARRAY[]::"ExamScope"[],
ADD COLUMN     "examWeights" JSONB;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "onboardedAt" TIMESTAMP(3),
ADD COLUMN     "targetExamYear" INTEGER,
ADD COLUMN     "targetNet" DECIMAL(5,2),
ADD COLUMN     "weeklyTestGoal" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "StudyPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examScope" "ExamScope" NOT NULL,
    "weekStart" DATE NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceSessionId" TEXT,
    "coachNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "topicId" TEXT,
    "kind" "PlanItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "targetQuestionCount" INTEGER,
    "estimatedMinutes" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT,
    "doneAt" TIMESTAMP(3),
    "verifiedBySessionId" TEXT,
    "carriedFrom" TEXT,

    CONSTRAINT "PlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StudyPlan_userId_weekStart_idx" ON "StudyPlan"("userId", "weekStart");

-- CreateIndex
CREATE UNIQUE INDEX "StudyPlan_userId_weekStart_key" ON "StudyPlan"("userId", "weekStart");

-- CreateIndex
CREATE INDEX "PlanItem_planId_sortOrder_idx" ON "PlanItem"("planId", "sortOrder");

-- CreateIndex
CREATE INDEX "PlanItem_topicId_idx" ON "PlanItem"("topicId");

-- CreateIndex
CREATE INDEX "CheckupResult_computedAt_idx" ON "CheckupResult"("computedAt");

-- CreateIndex
CREATE INDEX "CheckupSession_userId_status_expiresAt_idx" ON "CheckupSession"("userId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "CheckupSession_focusTopicId_idx" ON "CheckupSession"("focusTopicId");

-- AddForeignKey
ALTER TABLE "CheckupSession" ADD CONSTRAINT "CheckupSession_focusTopicId_fkey" FOREIGN KEY ("focusTopicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StudyPlan" ADD CONSTRAINT "StudyPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_planId_fkey" FOREIGN KEY ("planId") REFERENCES "StudyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanItem" ADD CONSTRAINT "PlanItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;
