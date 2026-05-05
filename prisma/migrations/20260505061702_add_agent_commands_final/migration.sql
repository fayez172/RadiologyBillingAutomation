-- CreateEnum
CREATE TYPE "AgentCommandStatus" AS ENUM ('PENDING', 'SENT', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateTable
CREATE TABLE "AgentCommand" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "command_type" TEXT NOT NULL,
    "payload" JSONB,
    "status" "AgentCommandStatus" NOT NULL DEFAULT 'PENDING',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "AgentCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentCommand_instance_id_idx" ON "AgentCommand"("instance_id");

-- CreateIndex
CREATE INDEX "AgentCommand_status_idx" ON "AgentCommand"("status");

-- AddForeignKey
ALTER TABLE "AgentCommand" ADD CONSTRAINT "AgentCommand_instance_id_fkey" FOREIGN KEY ("instance_id") REFERENCES "DbInstance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
