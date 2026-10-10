-- AlterEnum
ALTER TYPE "PracticeMode" ADD VALUE 'REVIEW';

-- CreateTable
CREATE TABLE "NotebookItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "examScope" "ExamScope" NOT NULL,
    "stage" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "lastReviewedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "wrongCount" INTEGER NOT NULL DEFAULT 1,
    "lastSessionId" TEXT NOT NULL,
    "lastWrongAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotebookItem_userId_resolvedAt_dueAt_idx" ON "NotebookItem"("userId", "resolvedAt", "dueAt");

-- CreateIndex
CREATE INDEX "NotebookItem_questionId_idx" ON "NotebookItem"("questionId");

-- CreateIndex
CREATE INDEX "NotebookItem_topicId_idx" ON "NotebookItem"("topicId");

-- CreateIndex
CREATE INDEX "NotebookItem_objectiveId_idx" ON "NotebookItem"("objectiveId");

-- CreateIndex
CREATE UNIQUE INDEX "NotebookItem_userId_questionId_key" ON "NotebookItem"("userId", "questionId");

-- AddForeignKey
ALTER TABLE "NotebookItem" ADD CONSTRAINT "NotebookItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookItem" ADD CONSTRAINT "NotebookItem_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookItem" ADD CONSTRAINT "NotebookItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookItem" ADD CONSTRAINT "NotebookItem_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "Objective"("id") ON DELETE SET NULL ON UPDATE CASCADE;

