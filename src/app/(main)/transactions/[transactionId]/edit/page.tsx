import { notFound } from "next/navigation";
import { TransactionForm } from "@/components/transaction-form";
import { requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFormOptions } from "@/lib/queries";

export const metadata = { title: "내역 수정" };

export default async function EditTransactionPage({
  params,
}: PageProps<"/transactions/[transactionId]/edit">) {
  const { transactionId } = await params;
  const { household, member } = await requireHouseholdContext();

  const transaction = await prisma.transaction.findFirst({
    // 다른 가구의 내역 id 로는 접근할 수 없다
    where: { id: transactionId, householdId: household.id },
  });

  if (!transaction) notFound();

  const options = await getFormOptions(household.id);

  return (
    <TransactionForm
      householdId={household.id}
      currentMemberId={member.id}
      options={options}
      transaction={{
        id: transaction.id,
        type: transaction.type,
        amount: transaction.amount,
        occurredAt: transaction.occurredAt,
        merchant: transaction.merchant,
        memo: transaction.memo,
        categoryId: transaction.categoryId,
        paymentMethod: transaction.paymentMethod,
        cardId: transaction.cardId,
        accountId: transaction.accountId,
        toAccountId: transaction.toAccountId,
        installmentMonths: transaction.installmentMonths,
        isInterestFree: transaction.isInterestFree,
        interestAmount: transaction.interestAmount,
        approvalNo: transaction.approvalNo,
        payerMemberId: transaction.payerMemberId,
        isShared: transaction.isShared,
        excludeFromStats: transaction.excludeFromStats,
      }}
    />
  );
}
