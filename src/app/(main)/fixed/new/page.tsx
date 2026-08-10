import { RecurringForm } from "@/components/recurring-form";
import { requireHouseholdContext } from "@/lib/auth";
import { getFormOptions } from "@/lib/queries";

export const metadata = { title: "고정지출 등록" };

export default async function NewFixedPage() {
  const { household } = await requireHouseholdContext();
  const options = await getFormOptions(household.id);

  return <RecurringForm householdId={household.id} options={options} />;
}
