import { notFound } from "next/navigation";
import { RecurringForm } from "@/components/recurring-form";
import { requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getFormOptions } from "@/lib/queries";

export const metadata = { title: "고정 항목 수정" };

export default async function EditFixedPage({
  params,
}: PageProps<"/fixed/[ruleId]">) {
  const { ruleId } = await params;
  const { household } = await requireHouseholdContext();

  const [rule, options] = await Promise.all([
    // 다른 가구 규칙 id 로는 접근할 수 없다
    prisma.recurringRule.findFirst({
      where: { id: ruleId, householdId: household.id },
    }),
    getFormOptions(household.id),
  ]);

  if (!rule) notFound();

  return (
    <RecurringForm
      householdId={household.id}
      options={options}
      rule={{
        id: rule.id,
        name: rule.name,
        kind: rule.kind,
        amount: rule.amount,
        isAmountVariable: rule.isAmountVariable,
        frequency: rule.frequency,
        dayOfMonth: rule.dayOfMonth,
        weekday: rule.weekday,
        monthOfYear: rule.monthOfYear,
        dueDateShift: rule.dueDateShift,
        ownerMemberId: rule.ownerMemberId,
        paymentMethod: rule.paymentMethod,
        cardId: rule.cardId,
        accountId: rule.accountId,
        toAccountId: rule.toAccountId,
        categoryId: rule.categoryId,
        notifyDaysBefore: rule.notifyDaysBefore,
        memo: rule.memo,
        type: rule.type,
      }}
    />
  );
}
