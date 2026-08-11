import { notFound, redirect } from "next/navigation";
import { AccountEditScreen } from "@/components/asset-form";
import { canManageAsset, requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFormOptions } from "@/lib/queries";

export const metadata = { title: "계좌 수정" };

export default async function EditAccountPage({
  params,
}: PageProps<"/accounts/[accountId]/edit">) {
  const { accountId } = await params;
  const { household, member } = await requireHouseholdContext();

  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId: household.id },
  });

  if (!account) notFound();

  if (!canManageAsset(member, account)) redirect("/cards?error=forbidden");

  const options = await getFormOptions(household.id);

  return (
    <AccountEditScreen
      members={options.members}
      currentMember={{ id: member.id, role: member.role }}
      account={{
        id: account.id,
        name: account.name,
        type: account.type,
        bankName: account.bankName,
        last4: account.last4,
        balance: account.balance,
        color: account.color,
        ownerMemberId: account.ownerMemberId,
      }}
    />
  );
}
