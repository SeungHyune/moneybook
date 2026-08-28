import { notFound, redirect } from "next/navigation";
import { OpeningBalanceForm } from "@/components/opening-balance-form";
import { canManageAsset, requireHouseholdContext } from "@/lib/auth";
import { getUpcomingStatementPeriod } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "기존 카드값 입력" };

export default async function OpeningBalancePage({
  params,
}: PageProps<"/cards/[cardId]/opening">) {
  const { cardId } = await params;
  const { household, member } = await requireHouseholdContext();

  const card = await prisma.card.findFirst({
    where: { id: cardId, householdId: household.id },
  });
  if (!card) notFound();

  if (card.type !== "CREDIT" || !card.billingDay) redirect(`/cards/${cardId}`);
  if (!canManageAsset(member, card)) redirect("/cards?error=forbidden");

  const upcoming = getUpcomingStatementPeriod(card);
  const billingDayLabel = upcoming
    ? `${upcoming.billingDate.getMonth() + 1}월 ${upcoming.billingDate.getDate()}일`
    : `매월 ${card.billingDay}일`;

  return (
    <OpeningBalanceForm
      cardId={card.id}
      cardName={`${card.issuer ? `${card.issuer} ` : ""}${card.name}`}
      billingDayLabel={billingDayLabel}
    />
  );
}
