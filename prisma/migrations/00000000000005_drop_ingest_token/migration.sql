-- DropIndex
DROP INDEX "users_ingestToken_key";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "ingestToken";
