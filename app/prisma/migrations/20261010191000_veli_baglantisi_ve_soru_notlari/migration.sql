-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "rolledBackAt" TIMESTAMP(3),
ADD COLUMN     "rolledBackByStaff" TEXT;

-- CreateTable
CREATE TABLE "QuestionNote" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "authorStaff" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByStaff" TEXT,

    CONSTRAINT "QuestionNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParentLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ParentLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QuestionNote_questionId_resolvedAt_idx" ON "QuestionNote"("questionId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ParentLink_tokenHash_key" ON "ParentLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ParentLink_userId_expiresAt_idx" ON "ParentLink"("userId", "expiresAt");

-- AddForeignKey
ALTER TABLE "QuestionNote" ADD CONSTRAINT "QuestionNote_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParentLink" ADD CONSTRAINT "ParentLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

