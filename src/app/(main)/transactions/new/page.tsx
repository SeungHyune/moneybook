import { TransactionForm } from "@/components/transaction-form";
import { requireHouseholdContext } from "@/lib/auth";
import { getFormOptions } from "@/lib/queries";
import type { TransactionType } from "@/generated/prisma/enums";

export const metadata = { title: "내역 등록" };

export default async function NewTransactionPage({
  searchParams,
}: PageProps<"/transactions/new">) {
  const { household, member } = await requireHouseholdContext();
  const options = await getFormOptions(household.id);

  const params = await searchParams;
  const typeParam = params.type;
  const defaultType: TransactionType =
    typeParam === "INCOME" || typeParam === "TRANSFER" ? typeParam : "EXPENSE";

  return (
    <TransactionForm
      householdId={household.id}
      currentMemberId={member.id}
      options={options}
      defaultType={defaultType}
    />
  );
}
