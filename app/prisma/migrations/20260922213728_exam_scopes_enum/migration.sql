-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExamScope" ADD VALUE 'LGS';
ALTER TYPE "ExamScope" ADD VALUE 'KPSS_LISANS';
ALTER TYPE "ExamScope" ADD VALUE 'KPSS_ONLISANS';
ALTER TYPE "ExamScope" ADD VALUE 'DGS';
ALTER TYPE "ExamScope" ADD VALUE 'ALES';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Grade" ADD VALUE 'GRADE_8';
ALTER TYPE "Grade" ADD VALUE 'UNIVERSITY';
