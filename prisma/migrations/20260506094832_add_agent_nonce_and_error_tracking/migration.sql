-- AlterTable
ALTER TABLE "DbInstance" ADD COLUMN     "agent_last_error" TEXT;

-- CreateTable
CREATE TABLE "AgentNonce" (
    "id" TEXT NOT NULL,
    "instance_id" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentNonce_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentNonce_expires_at_idx" ON "AgentNonce"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "AgentNonce_instance_id_nonce_key" ON "AgentNonce"("instance_id", "nonce");
