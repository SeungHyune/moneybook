-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "createdByMemberId" UUID;

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "createdByMemberId" UUID;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "household_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_createdByMemberId_fkey" FOREIGN KEY ("createdByMemberId") REFERENCES "household_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
