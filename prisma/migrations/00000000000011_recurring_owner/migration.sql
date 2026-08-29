
-- AlterTable
ALTER TABLE "recurring_rules" ADD COLUMN     "ownerMemberId" UUID;

-- AddForeignKey
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_ownerMemberId_fkey" FOREIGN KEY ("ownerMemberId") REFERENCES "household_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

