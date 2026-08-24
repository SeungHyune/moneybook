import { notFound } from "next/navigation";
import { AssetDetail } from "@/components/asset-detail";
import { canManageAsset, requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/lib/queries";
import { ACCOUNT_TYPE_LABEL, ownerPrefix } from "@/lib/labels";
import { formatWon, toYearMonth } from "@/lib/utils";

export const metadata = { title: "계좌 내역" };

/** 계좌 하나의 월별 입출금 내역 (이체 수신 포함) */
export default async function AccountDetailPage({
  params,
  searchParams,
}: PageProps<"/accounts/[accountId]">) {
  const { accountId } = await params;
  const { household, member } = await requireHouseholdContext();

  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId: household.id },
    include: { ownerMember: { select: { displayName: true } } },
  });
  if (!account) notFound();

  const query = await searchParams;
  const monthParam = query.month;
  const yearMonth =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : toYearMonth(new Date());

  const transactions = await getTransactions(household.id, {
    yearMonth,
    monthStartDay: household.monthStartDay,
    accountId: account.id,
    take: 300,
  });

  // 이 계좌 기준 들어온 돈 / 나간 돈 (이체는 방향으로 나눈다)
  let moneyIn = 0;
  let moneyOut = 0;
  for (const transaction of transactions) {
    if (transaction.type === "INCOME") {
      moneyIn += transaction.amount;
    } else if (transaction.type === "EXPENSE") {
      moneyOut += transaction.amount;
    } else {
      // TRANSFER: 이 계좌가 받는 쪽이면 입금, 보내는 쪽이면 출금
      if (transaction.toAccountId === account.id) moneyIn += transaction.amount;
      if (transaction.accountId === account.id) moneyOut += transaction.amount;
    }
  }

  return (
    <AssetDetail
      title={`${ownerPrefix(account.ownerMember)}${account.bankName ? `${account.bankName} ` : ""}${account.name}`}
      subtitle={`${ACCOUNT_TYPE_LABEL[account.type]}${account.last4 ? ` · ${account.last4}` : ""}`}
      color={account.color}
      editHref={
        canManageAsset(member, account)
          ? `/accounts/${account.id}/edit`
          : undefined
      }
      yearMonth={yearMonth}
      summaryItems={[
        { label: "들어온 돈", value: formatWon(moneyIn), tone: "income" },
        { label: "나간 돈", value: formatWon(moneyOut), tone: "expense" },
        { label: "현재 잔액", value: formatWon(account.balance) },
      ]}
      transactions={transactions}
      emptyMessage="이 달에는 이 계좌의 입출금 내역이 없어요."
    />
  );
}
