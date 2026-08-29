import { notFound } from "next/navigation";
import { SavingsGoalForm } from "@/components/savings-goal-form";
import { requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "저축 목표 수정" };

export default async function EditSavingsGoalPage({
  params,
}: PageProps<"/budget/goals/[goalId]">) {
  const { goalId } = await params;
  const { household } = await requireHouseholdContext();

  const [goal, accounts] = await Promise.all([
    // 다른 가구 목표 id 로는 접근할 수 없다
    prisma.savingsGoal.findFirst({
      where: { id: goalId, householdId: household.id },
    }),
    prisma.account.findMany({
      where: { householdId: household.id, isActive: true },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
      select: { id: true, name: true, bankName: true, type: true, balance: true },
    }),
  ]);

  if (!goal) notFound();

  return (
    <SavingsGoalForm
      goal={{
        id: goal.id,
        name: goal.name,
        targetAmount: goal.targetAmount,
        targetDate: goal.targetDate,
        accountId: goal.accountId,
        startAmount: goal.startAmount,
      }}
      accounts={accounts}
    />
  );
}
