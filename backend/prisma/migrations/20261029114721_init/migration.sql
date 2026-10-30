/*
  Warnings:

  - You are about to drop the column `errorCode` on the `AIUsage` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedCostUsd` on the `AIUsage` table. All the data in the column will be lost.
  - You are about to drop the column `eventType` on the `AuditEvent` table. All the data in the column will be lost.
  - You are about to drop the column `metadata` on the `AuditEvent` table. All the data in the column will be lost.
  - You are about to drop the column `success` on the `AuditEvent` table. All the data in the column will be lost.
  - You are about to drop the column `citations` on the `Message` table. All the data in the column will be lost.
  - Added the required column `action` to the `AuditEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "AuditEvent_eventType_createdAt_idx";

-- AlterTable
ALTER TABLE "AIUsage" DROP COLUMN "errorCode",
DROP COLUMN "estimatedCostUsd",
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "estimatedCost" DECIMAL(12,8) NOT NULL DEFAULT 0,
ADD COLUMN     "totalTokens" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "provider" SET DEFAULT 'openai',
ALTER COLUMN "model" DROP NOT NULL;

-- AlterTable
ALTER TABLE "AuditEvent" DROP COLUMN "eventType",
DROP COLUMN "metadata",
DROP COLUMN "success",
ADD COLUMN     "action" TEXT NOT NULL,
ADD COLUMN     "details" JSONB,
ADD COLUMN     "ipAddress" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "citations";

-- CreateIndex
CREATE INDEX "AIUsage_conversationId_idx" ON "AIUsage"("conversationId");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");
