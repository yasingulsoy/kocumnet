-- CreateTable
CREATE TABLE "TeacherAnswer" (
    "id" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "value" JSONB,
    "note" TEXT,
    "answeredByStaff" TEXT,
    "answeredAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "appliedByStaff" TEXT,
    "appliedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeacherAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherAnswer_questionKey_key" ON "TeacherAnswer"("questionKey");

