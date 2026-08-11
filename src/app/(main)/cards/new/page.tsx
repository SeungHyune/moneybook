import { AssetForm } from "@/components/asset-form";
import { requireHouseholdContext } from "@/lib/auth";
import { getFormOptions } from "@/lib/queries";

export const metadata = { title: "카드/계좌 등록" };

export default async function NewAssetPage({
  searchParams,
}: PageProps<"/cards/new">) {
  const { household, member } = await requireHouseholdContext();
  const options = await getFormOptions(household.id);

  const params = await searchParams;
  const defaultTab = params.tab === "account" ? "account" : "card";

  return (
    <AssetForm
      householdId={household.id}
      members={options.members}
      accounts={options.accounts}
      currentMember={{ id: member.id, role: member.role }}
      defaultTab={defaultTab}
    />
  );
}
