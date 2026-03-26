-- CreateTable
CREATE TABLE "RemoteRadiologist" (
    "id" TEXT NOT NULL,
    "remote_id" INTEGER NOT NULL,
    "first_name" TEXT,
    "middle_name" TEXT,
    "last_name" TEXT,
    "display_name" TEXT NOT NULL,
    "owner_id" INTEGER NOT NULL DEFAULT 3,
    "instance_id" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "radiologist_id" TEXT,

    CONSTRAINT "RemoteRadiologist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RemoteRadiologist_instance_id_idx" ON "RemoteRadiologist"("instance_id");

-- CreateIndex
CREATE UNIQUE INDEX "RemoteRadiologist_remote_id_instance_id_key" ON "RemoteRadiologist"("remote_id", "instance_id");

-- AddForeignKey
ALTER TABLE "RemoteRadiologist" ADD CONSTRAINT "RemoteRadiologist_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemoteRadiologist" ADD CONSTRAINT "RemoteRadiologist_radiologist_id_fkey" FOREIGN KEY ("radiologist_id") REFERENCES "Radiologist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
