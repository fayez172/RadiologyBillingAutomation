-- AlterTable
ALTER TABLE "DbInstance" ADD COLUMN     "agent_api_key" TEXT,
ADD COLUMN     "agent_last_seen_at" TIMESTAMP(3),
ADD COLUMN     "agent_mode" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "AgentPushLog" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "pushed_at" TIMESTAMP(3) NOT NULL,
    "is_backfill" BOOLEAN NOT NULL DEFAULT false,
    "is_heartbeat" BOOLEAN NOT NULL DEFAULT false,
    "studies_count" INTEGER NOT NULL DEFAULT 0,
    "deletes_count" INTEGER NOT NULL DEFAULT 0,
    "ref_data_count" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'OK',
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPushLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentPushLog_instance_id_idx" ON "AgentPushLog"("instance_id");

-- CreateIndex
CREATE INDEX "AgentPushLog_pushed_at_idx" ON "AgentPushLog"("pushed_at");

-- AddForeignKey
ALTER TABLE "AgentPushLog" ADD CONSTRAINT "AgentPushLog_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
