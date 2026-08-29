import { SavingsGoalForm } from "@/components/savings-goal-form";
import { requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "저축 목표" };

export default async function NewSavingsGoalPage() {
  const { household } = await requireHouseholdContext();

  // 저축 성격 계좌를 먼저 보여준다 — 목표를 붙일 곳은 보통 적금이다
  const accounts = await prisma.account.findMany({
    where: { householdId: household.id, isActive: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    select: { id: true, name: true, bankName: true, type: true, balance: true },
  });

  return <SavingsGoalForm accounts={accounts} />;
}
