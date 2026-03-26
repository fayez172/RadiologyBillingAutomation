-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'VIEWER';

-- AlterTable
ALTER TABLE "ClientAlias" ADD COLUMN     "remote_id" INTEGER;

-- AlterTable
ALTER TABLE "DbInstance" ADD COLUMN     "auto_sync" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "owner_ids" TEXT NOT NULL DEFAULT '[3]',
ADD COLUMN     "sync_time" TEXT NOT NULL DEFAULT '02:00';

-- AlterTable
ALTER TABLE "RadiologistAlias" ADD COLUMN     "remote_id" INTEGER;

-- AlterTable
ALTER TABLE "Study" ADD COLUMN     "add1_rad_remote_id" INTEGER,
ADD COLUMN     "add2_rad_remote_id" INTEGER,
ADD COLUMN     "add3_rad_remote_id" INTEGER,
ADD COLUMN     "final_rad_remote_id" INTEGER,
ADD COLUMN     "modality_remote_id" INTEGER,
ADD COLUMN     "procedure_remote_id" INTEGER,
ADD COLUMN     "reported_by_remote_id" INTEGER,
ADD COLUMN     "study_source_remote_id" INTEGER;

-- CreateTable
CREATE TABLE "RemoteModality" (
    "id" TEXT NOT NULL,
    "remote_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "alt_names" TEXT,
    "owner_id" INTEGER NOT NULL DEFAULT 3,
    "instance_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RemoteModality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemoteProcedure" (
    "id" TEXT NOT NULL,
    "remote_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "procedure_code" TEXT,
    "parent_modality_id" TEXT,
    "owner_id" INTEGER NOT NULL DEFAULT 3,
    "instance_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "billing_type" TEXT,
    "billing_type_dr" TEXT,

    CONSTRAINT "RemoteProcedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemoteStudySource" (
    "id" TEXT NOT NULL,
    "remote_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" INTEGER NOT NULL DEFAULT 3,
    "instance_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "client_id" TEXT,

    CONSTRAINT "RemoteStudySource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemoteModality_instance_id_idx" ON "RemoteModality"("instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteModality_remote_id_instance_id_key" ON "RemoteModality"("remote_id", "instance_id");

-- CreateIndex
CREATE INDEX "RemoteProcedure_instance_id_idx" ON "RemoteProcedure"("instance_id");

-- CreateIndex
CREATE INDEX "RemoteProcedure_parent_modality_id_idx" ON "RemoteProcedure"("parent_modality_id");

-- CreateIndex
CREATE INDEX "RemoteProcedure_billing_type_idx" ON "RemoteProcedure"("billing_type");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteProcedure_remote_id_instance_id_key" ON "RemoteProcedure"("remote_id", "instance_id");

-- CreateIndex
CREATE INDEX "RemoteStudySource_instance_id_idx" ON "RemoteStudySource"("instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteStudySource_remote_id_instance_id_key" ON "RemoteStudySource"("remote_id", "instance_id");

-- AddForeignKey
ALTER TABLE "RemoteModality" ADD CONSTRAINT "RemoteModality_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteProcedure" ADD CONSTRAINT "RemoteProcedure_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteProcedure" ADD CONSTRAINT "RemoteProcedure_parent_modality_id_fkey" FOREIGN KEY ("parent_modality_id") REFERENCES "RemoteModality"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteStudySource" ADD CONSTRAINT "RemoteStudySource_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteStudySource" ADD CONSTRAINT "RemoteStudySource_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
