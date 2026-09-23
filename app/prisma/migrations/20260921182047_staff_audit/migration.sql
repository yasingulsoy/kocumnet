-- AlterTable
ALTER TABLE "Entitlement" ADD COLUMN     "grantedByStaff" TEXT,
ADD COLUMN     "revokedByStaff" TEXT;

-- AlterTable
ALTER TABLE "ImportBatch" ADD COLUMN     "createdByStaff" TEXT;

-- AlterTable
ALTER TABLE "MediaAsset" ADD COLUMN     "uploadedByStaff" TEXT;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "createdByStaff" TEXT,
ADD COLUMN     "updatedByStaff" TEXT;
