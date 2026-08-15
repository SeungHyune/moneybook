-- CreateEnum
CREATE TYPE "IngestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DISCARDED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "ingestToken" TEXT;

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingest_inbox" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "rawText" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "source" TEXT,
    "amount" INTEGER,
    "merchant" TEXT,
    "occurredAt" TIMESTAMP(3),
    "cardLast4" TEXT,
    "installmentMonths" INTEGER NOT NULL DEFAULT 1,
    "isCancel" BOOLEAN NOT NULL DEFAULT false,
    "cardId" UUID,
    "status" "IngestStatus" NOT NULL DEFAULT 'PENDING',
    "transactionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ingest_inbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_userId_idx" ON "push_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "ingest_inbox_userId_status_idx" ON "ingest_inbox"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ingest_inbox_userId_textHash_key" ON "ingest_inbox"("userId", "textHash");

-- CreateIndex
CREATE UNIQUE INDEX "users_ingestToken_key" ON "users"("ingestToken");

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_inbox" ADD CONSTRAINT "ingest_inbox_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Supabase: 새 테이블도 PostgREST 노출을 막는다 (README "보안" 참고)
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ingest_inbox" ENABLE ROW LEVEL SECURITY;
