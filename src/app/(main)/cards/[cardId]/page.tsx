import { notFound } from "next/navigation";
import { AssetDetail } from "@/components/asset-detail";
import { canManageAsset, requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/lib/queries";
import { CARD_TYPE_LABEL, ownerPrefix } from "@/lib/labels";
import { formatWon, toYearMonth } from "@/lib/utils";

export const metadata = { title: "카드 내역" };

/** 카드 하나의 월별 사용 내역 */
export default async function CardDetailPage({
  params,
  searchParams,
}: PageProps<"/cards/[cardId]">) {
  const { cardId } = await params;
  const { household, member } = await requireHouseholdContext();

  const card = await prisma.card.findFirst({
    // 다른 가구의 카드 id 로는 접근할 수 없다
    where: { id: cardId, householdId: household.id },
    include: { ownerMember: { select: { displayName: true } } },
  });
  if (!card) notFound();

  const query = await searchParams;
  const monthParam = query.month;
  const yearMonth =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : toYearMonth(new Date());

  const transactions = await getTransactions(household.id, {
    yearMonth,
    monthStartDay: household.monthStartDay,
    cardId: card.id,
    take: 300,
  });

  const expense = transactions
    .filter((transaction) => transaction.type === "EXPENSE")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const installmentCount = transactions.filter(
    (transaction) => transaction.installmentMonths > 1,
  ).length;

  return (
    <AssetDetail
      title={`${ownerPrefix(card.ownerMember)}${card.issuer ? `${card.issuer} ` : ""}${card.name}`}
      subtitle={`${CARD_TYPE_LABEL[card.type]}${card.last4 ? ` · ${card.last4}` : ""}${
        card.type === "CREDIT" && card.billingDay
          ? ` · 매월 ${card.billingDay}일 결제`
          : ""
      }`}
      color={card.color}
      editHref={
        canManageAsset(member, card) ? `/cards/${card.id}/edit` : undefined
      }
      yearMonth={yearMonth}
      summaryItems={[
        { label: "이 달 사용액", value: formatWon(expense), tone: "expense" },
        { label: "건수", value: `${transactions.length}건` },
        { label: "할부 건", value: `${installmentCount}건` },
      ]}
      transactions={transactions}
      emptyMessage="이 달에는 이 카드로 결제한 내역이 없어요."
    />
  );
}
