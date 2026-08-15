import {
  TransactionForm,
  type TransactionInitial,
} from "@/components/transaction-form";
import { requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFormOptions } from "@/lib/queries";
import type { TransactionType } from "@/generated/prisma/enums";

export const metadata = { title: "내역 등록" };

export default async function NewTransactionPage({
  searchParams,
}: PageProps<"/transactions/new">) {
  const { household, member, user } = await requireHouseholdContext();
  const options = await getFormOptions(household.id);

  const params = await searchParams;
  const typeParam = params.type;
  const defaultType: TransactionType =
    typeParam === "INCOME" || typeParam === "TRANSFER" ? typeParam : "EXPENSE";

  // 자동 수집함에서 "확인하고 등록"으로 넘어온 경우 파싱 결과를 채워준다
  let initial: TransactionInitial | undefined;
  const inboxParam = params.inbox;

  if (typeof inboxParam === "string") {
    const item = await prisma.ingestInbox.findFirst({
      where: { id: inboxParam, userId: user.id, status: "PENDING" },
    });

    if (item) {
      initial = {
        inboxId: item.id,
        amount: item.amount,
        merchant: item.merchant,
        occurredAt: item.occurredAt,
        cardId: item.cardId,
        installmentMonths: item.installmentMonths,
        rawText: item.rawText,
      };
    }
  }

  return (
    <TransactionForm
      householdId={household.id}
      currentMemberId={member.id}
      options={options}
      defaultType={defaultType}
      initial={initial}
    />
  );
}
