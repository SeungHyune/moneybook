import { notFound, redirect } from "next/navigation";
import { CardEditScreen } from "@/components/asset-form";
import { canManageAsset, requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFormOptions } from "@/lib/queries";

export const metadata = { title: "카드 수정" };

export default async function EditCardPage({
  params,
}: PageProps<"/cards/[cardId]/edit">) {
  const { cardId } = await params;
  const { household, member } = await requireHouseholdContext();

  const card = await prisma.card.findFirst({
    // 다른 가구의 카드 id 로는 접근할 수 없다
    where: { id: cardId, householdId: household.id },
  });

  if (!card) notFound();

  // 구성원은 자기가 등록한 카드만 수정할 수 있다
  if (!canManageAsset(member, card)) redirect("/cards?error=forbidden");

  const options = await getFormOptions(household.id);

  return (
    <CardEditScreen
      members={options.members}
      accounts={options.accounts}
      currentMember={{ id: member.id, role: member.role }}
      card={{
        id: card.id,
        name: card.name,
        issuer: card.issuer,
        type: card.type,
        last4: card.last4,
        color: card.color,
        ownerMemberId: card.ownerMemberId,
        billingDay: card.billingDay,
        statementStartDay: card.statementStartDay,
        statementEndDay: card.statementEndDay,
        paymentAccountId: card.paymentAccountId,
        creditLimit: card.creditLimit,
      }}
    />
  );
}
