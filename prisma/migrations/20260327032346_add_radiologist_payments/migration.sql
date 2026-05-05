/*
  Warnings:

  - You are about to drop the column `updated_at` on the `Radiologist` table. All the data in the column will be lost.
  - You are about to alter the column `total_billed` on the `Radiologist` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Decimal(12,2)`.
  - You are about to alter the column `total_paid` on the `Radiologist` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Decimal(12,2)`.
  - You are about to alter the column `current_due` on the `Radiologist` table. The data in that column could be lost. The data in that column will be cast from `Decimal(14,2)` to `Decimal(12,2)`.

*/
-- AlterTable
ALTER TABLE "Radiologist" DROP COLUMN "updated_at",
ADD COLUMN     "last_payment_at" TIMESTAMP(3),
ALTER COLUMN "total_billed" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "total_paid" SET DATA TYPE DECIMAL(12,2),
ALTER COLUMN "current_due" SET DATA TYPE DECIMAL(12,2);

-- CreateTable
CREATE TABLE "RadiologistPayment" (
    "id" TEXT NOT NULL,
    "radiologist_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "payment_date" TIMESTAMP(3) NOT NULL,
    "reference" TEXT,
    "note" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RadiologistPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RadiologistPayment_radiologist_id_payment_date_idx" ON "RadiologistPayment"("radiologist_id", "payment_date");

-- AddForeignKey
ALTER TABLE "RadiologistPayment" ADD CONSTRAINT "RadiologistPayment_radiologist_id_fkey" FOREIGN KEY ("radiologist_id") REFERENCES "Radiologist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
