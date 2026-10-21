-- CreateEnum
CREATE TYPE "NoteKind" AS ENUM ('STAFF', 'STUDENT_REPORT');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('YANLIS_ANAHTAR', 'COZUM_HATALI', 'YAZIM_HATASI', 'GORSEL_SORUNU', 'SORU_ANLASILMIYOR', 'DIGER');

-- CreateEnum
CREATE TYPE "SessionMode" AS ENUM ('ONLINE', 'PAPER');

-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('PACKAGE', 'TOPIC_PRACTICE');

-- AlterEnum
ALTER TYPE "PackageKind" ADD VALUE 'MOCK';

-- AlterTable
ALTER TABLE "Answer" ADD COLUMN     "firstAnsweredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CheckupSession" ADD COLUMN     "mode" "SessionMode" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "Objective" ADD COLUMN     "summary" JSONB,
ADD COLUMN     "summaryUpdatedByStaff" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "hints" JSONB,
ADD COLUMN     "videoUrl" TEXT;

-- AlterTable
ALTER TABLE "QuestionNote" ADD COLUMN     "kind" "NoteKind" NOT NULL DEFAULT 'STAFF',
ADD COLUMN     "reason" "ReportReason",
ADD COLUMN     "reportedById" TEXT,
ADD COLUMN     "sessionId" TEXT,
ALTER COLUMN "authorStaff" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SessionItem" ADD COLUMN     "hintsUsed" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "dailyQuestionGoal" INTEGER NOT NULL DEFAULT 10;

-- CreateTable
CREATE TABLE "PackageQuestion" (
    "id" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "PackageQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudyGroup" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "examScope" "ExamScope",
    "note" TEXT,
    "createdByStaff" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedByStaff" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "kind" "AssignmentKind" NOT NULL,
    "packageId" TEXT,
    "topicId" TEXT,
    "questionCount" INTEGER,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "createdByStaff" TEXT NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByStaff" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoachQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "questionId" TEXT,
    "sessionId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answerBody" TEXT,
    "answeredAt" TIMESTAMP(3),
    "answeredByStaff" TEXT,
    "readAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "closedByStaff" TEXT,

    CONSTRAINT "CoachQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PackageQuestion_packageId_sortOrder_idx" ON "PackageQuestion"("packageId", "sortOrder");

-- CreateIndex
CREATE INDEX "PackageQuestion_questionId_idx" ON "PackageQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "PackageQuestion_packageId_questionId_key" ON "PackageQuestion"("packageId", "questionId");

-- CreateIndex
CREATE INDEX "StudyGroup_archivedAt_idx" ON "StudyGroup"("archivedAt");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "Assignment_groupId_dueAt_idx" ON "Assignment"("groupId", "dueAt");

-- CreateIndex
CREATE INDEX "Assignment_packageId_idx" ON "Assignment"("packageId");

-- CreateIndex
CREATE INDEX "Assignment_topicId_idx" ON "Assignment"("topicId");

-- CreateIndex
CREATE INDEX "CoachQuestion_userId_createdAt_idx" ON "CoachQuestion"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "CoachQuestion_answeredAt_closedAt_createdAt_idx" ON "CoachQuestion"("answeredAt", "closedAt", "createdAt");

-- CreateIndex
CREATE INDEX "CoachQuestion_questionId_idx" ON "CoachQuestion"("questionId");

-- CreateIndex
CREATE INDEX "QuestionNote_kind_resolvedAt_createdAt_idx" ON "QuestionNote"("kind", "resolvedAt", "createdAt");

-- CreateIndex
CREATE INDEX "QuestionNote_reportedById_createdAt_idx" ON "QuestionNote"("reportedById", "createdAt");

-- AddForeignKey
ALTER TABLE "PackageQuestion" ADD CONSTRAINT "PackageQuestion_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackageQuestion" ADD CONSTRAINT "PackageQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionNote" ADD CONSTRAINT "QuestionNote_reportedById_fkey" FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "StudyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "Package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachQuestion" ADD CONSTRAINT "CoachQuestion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoachQuestion" ADD CONSTRAINT "CoachQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE SET NULL ON UPDATE CASCADE;

