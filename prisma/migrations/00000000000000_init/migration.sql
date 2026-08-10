-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK_TRANSFER', 'AUTO_DEBIT', 'MOBILE_PAY', 'POINT', 'GIFT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('CREDIT', 'DEBIT', 'PREPAID');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CHECKING', 'SAVINGS', 'CASH', 'INVESTMENT', 'LOAN', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurringKind" AS ENUM ('SALARY', 'SIDE_INCOME', 'CARD_BILL', 'MAINTENANCE_FEE', 'TELECOM', 'UTILITY', 'RENT', 'LOAN_REPAYMENT', 'INSURANCE', 'SUBSCRIPTION', 'SAVINGS', 'EDUCATION', 'MEMBERSHIP', 'OTHER');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('MONTHLY', 'WEEKLY', 'YEARLY', 'BIMONTHLY', 'QUARTERLY');

-- CreateEnum
CREATE TYPE "DueDateShift" AS ENUM ('NONE', 'PREV_BUSINESS_DAY', 'NEXT_BUSINESS_DAY');

-- CreateEnum
CREATE TYPE "OccurrenceStatus" AS ENUM ('PENDING', 'PAID', 'SKIPPED', 'OVERDUE');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT,
    "nickname" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "kakaoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastHouseholdId" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "households" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KRW',
    "monthStartDay" INTEGER NOT NULL DEFAULT 1,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Seoul',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "households_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "displayName" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "role" "MemberRole" NOT NULL DEFAULT 'MEMBER',
    "status" "InviteStatus" NOT NULL DEFAULT 'PENDING',
    "email" TEXT,
    "memo" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedById" UUID NOT NULL,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL DEFAULT 'CHECKING',
    "bankName" TEXT,
    "last4" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#0ea5e9',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "memo" TEXT,
    "ownerMemberId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT,
    "type" "CardType" NOT NULL DEFAULT 'CREDIT',
    "last4" TEXT,
    "color" TEXT NOT NULL DEFAULT '#8b5cf6',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "ownerMemberId" UUID,
    "billingDay" INTEGER,
    "statementStartDay" INTEGER,
    "statementEndDay" INTEGER,
    "paymentAccountId" UUID,
    "creditLimit" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL DEFAULT 'EXPENSE',
    "icon" TEXT,
    "color" TEXT NOT NULL DEFAULT '#64748b',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "merchant" TEXT,
    "memo" TEXT,
    "categoryId" UUID,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CARD',
    "cardId" UUID,
    "accountId" UUID,
    "toAccountId" UUID,
    "installmentMonths" INTEGER NOT NULL DEFAULT 1,
    "isInterestFree" BOOLEAN NOT NULL DEFAULT true,
    "interestAmount" INTEGER NOT NULL DEFAULT 0,
    "approvalNo" TEXT,
    "payerMemberId" UUID,
    "createdByMemberId" UUID,
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "excludeFromStats" BOOLEAN NOT NULL DEFAULT false,
    "receiptUrl" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "recurringRuleId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" UUID NOT NULL,
    "transactionId" UUID NOT NULL,
    "round" INTEGER NOT NULL,
    "totalRounds" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "interest" INTEGER NOT NULL DEFAULT 0,
    "billingDate" TIMESTAMP(3) NOT NULL,
    "isBilled" BOOLEAN NOT NULL DEFAULT false,
    "statementId" UUID,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_rules" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RecurringKind" NOT NULL DEFAULT 'OTHER',
    "type" "TransactionType" NOT NULL DEFAULT 'EXPENSE',
    "amount" INTEGER NOT NULL,
    "isAmountVariable" BOOLEAN NOT NULL DEFAULT false,
    "frequency" "Frequency" NOT NULL DEFAULT 'MONTHLY',
    "dayOfMonth" INTEGER,
    "weekday" INTEGER,
    "monthOfYear" INTEGER,
    "dueDateShift" "DueDateShift" NOT NULL DEFAULT 'NONE',
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'AUTO_DEBIT',
    "cardId" UUID,
    "accountId" UUID,
    "categoryId" UUID,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "autoCreate" BOOLEAN NOT NULL DEFAULT false,
    "notifyDaysBefore" INTEGER NOT NULL DEFAULT 1,
    "memo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_occurrences" (
    "id" UUID NOT NULL,
    "ruleId" UUID NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "expectedAmount" INTEGER NOT NULL,
    "actualAmount" INTEGER,
    "status" "OccurrenceStatus" NOT NULL DEFAULT 'PENDING',
    "paidAt" TIMESTAMP(3),
    "memo" TEXT,
    "transactionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_occurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_statements" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "billingDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "lumpSumAmount" INTEGER NOT NULL DEFAULT 0,
    "installmentAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "budgets" (
    "id" UUID NOT NULL,
    "householdId" UUID NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "categoryId" UUID,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_kakaoId_key" ON "users"("kakaoId");

-- CreateIndex
CREATE INDEX "household_members_userId_idx" ON "household_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "household_members_householdId_userId_key" ON "household_members"("householdId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");

-- CreateIndex
CREATE INDEX "invites_householdId_idx" ON "invites"("householdId");

-- CreateIndex
CREATE INDEX "accounts_householdId_idx" ON "accounts"("householdId");

-- CreateIndex
CREATE INDEX "cards_householdId_idx" ON "cards"("householdId");

-- CreateIndex
CREATE INDEX "categories_householdId_idx" ON "categories"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "categories_householdId_type_name_parentId_key" ON "categories"("householdId", "type", "name", "parentId");

-- CreateIndex
CREATE INDEX "transactions_householdId_occurredAt_idx" ON "transactions"("householdId", "occurredAt");

-- CreateIndex
CREATE INDEX "transactions_householdId_categoryId_idx" ON "transactions"("householdId", "categoryId");

-- CreateIndex
CREATE INDEX "transactions_cardId_occurredAt_idx" ON "transactions"("cardId", "occurredAt");

-- CreateIndex
CREATE INDEX "transactions_accountId_occurredAt_idx" ON "transactions"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "installment_plans_billingDate_idx" ON "installment_plans"("billingDate");

-- CreateIndex
CREATE UNIQUE INDEX "installment_plans_transactionId_round_key" ON "installment_plans"("transactionId", "round");

-- CreateIndex
CREATE INDEX "recurring_rules_householdId_isActive_idx" ON "recurring_rules"("householdId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_occurrences_transactionId_key" ON "recurring_occurrences"("transactionId");

-- CreateIndex
CREATE INDEX "recurring_occurrences_dueDate_status_idx" ON "recurring_occurrences"("dueDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "recurring_occurrences_ruleId_yearMonth_key" ON "recurring_occurrences"("ruleId", "yearMonth");

-- CreateIndex
CREATE INDEX "card_statements_householdId_yearMonth_idx" ON "card_statements"("householdId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "card_statements_cardId_yearMonth_key" ON "card_statements"("cardId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_householdId_yearMonth_categoryId_key" ON "budgets"("householdId", "yearMonth", "categoryId");

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "household_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "household_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_toAccountId_fkey" FOREIGN KEY ("toAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_payerMemberId_fkey" FOREIGN KEY ("payerMemberId") REFERENCES "household_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "household_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "recurring_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installment_plans" ADD CONSTRAINT "installment_plans_statementId_fkey" FOREIGN KEY ("statementId") REFERENCES "card_statements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "recurring_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_occurrences" ADD CONSTRAINT "recurring_occurrences_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "households"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
