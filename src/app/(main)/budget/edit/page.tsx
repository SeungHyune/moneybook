import { BudgetForm } from "@/components/budget-form";
import { requireHouseholdContext } from "@/lib/auth";
import { getBudgetOverview } from "@/lib/queries";
import { toYearMonth } from "@/lib/utils";

export const metadata = { title: "예산 수정" };

export default async function BudgetEditPage({
  searchParams,
}: PageProps<"/budget/edit">) {
  const { household } = await requireHouseholdContext();
  const params = await searchParams;

  const monthParam = params.month;
  const yearMonth =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : toYearMonth(new Date());

  const overview = await getBudgetOverview(
    household.id,
    yearMonth,
    household.monthStartDay,
  );

  return (
    <BudgetForm
      yearMonth={yearMonth}
      monthlyLimit={overview.monthlyLimit}
      categories={overview.items.map((item) => ({
        categoryId: item.categoryId,
        name: item.name,
        icon: item.icon,
        color: item.color,
        limit: item.limit,
        spent: item.spent,
      }))}
    />
  );
}
