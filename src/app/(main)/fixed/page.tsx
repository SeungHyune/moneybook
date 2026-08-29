import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { PlanTabs } from "@/components/plan-tabs";
import { FixedViews, type FixedRow } from "@/components/fixed-views";
import { requireHouseholdContext } from "@/lib/auth";
import { getFixedSchedule } from "@/lib/queries";
import { PAYMENT_METHOD_LABEL } from "@/lib/labels";
import { formatWon, toYearMonth } from "@/lib/utils";

export const metadata = { title: "고정지출" };

export default async function FixedPage({ searchParams }: PageProps<"/fixed">) {
  const { household } = await requireHouseholdContext();
  const params = await searchParams;

  const monthParam = params.month;
  const yearMonth =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : toYearMonth(new Date());

  const schedule = await getFixedSchedule(household.id, yearMonth);

  const income = schedule.filter((item) => item.rule.type === "INCOME");
  const expense = schedule.filter((item) => item.rule.type === "EXPENSE");

  const expectedIncome = income.reduce((sum, item) => sum + item.amount, 0);
  const expectedExpense = expense.reduce((sum, item) => sum + item.amount, 0);

  const paidCount = schedule.filter((item) => item.status === "PAID").length;

  /*
   * 화면에서 쓸 모양으로 미리 정리한다. 결제수단 표기처럼 관계를 타고
   * 들어가는 건 서버에서 끝내고, 클라이언트는 묶고 접는 일만 하게 둔다.
   */
  const rows: FixedRow[] = schedule.map((item) => ({
    id: item.rule.id,
    name: item.rule.name,
    kind: item.rule.kind,
    type: item.rule.type === "INCOME" ? "INCOME" : "EXPENSE",
    amount: item.amount,
    ruleAmount: item.rule.amount,
    dueDay: item.dueDate.getDate(),
    isAmountVariable: item.rule.isAmountVariable,
    status: item.status,
    ownerName: item.rule.ownerMember?.displayName ?? null,
    methodText: item.rule.card
      ? `${item.rule.card.name}${item.rule.card.last4 ? ` (${item.rule.card.last4})` : ""}`
      : item.rule.account
        ? `${item.rule.account.bankName ?? ""} ${item.rule.account.name}`.trim()
        : PAYMENT_METHOD_LABEL[item.rule.paymentMethod],
  }));

  return (
    <>
      <AppHeader
        title="계획"
        subtitle="예산과 고정지출"
        action={
          <Link
            href="/fixed/new"
            aria-label="고정지출 추가"
            className="flex size-9 items-center justify-center rounded-full text-primary transition active:bg-surface-muted"
          >
            <Plus className="size-5" />
          </Link>
        }
      />

      <div className="space-y-4 px-4 py-4">
        <PlanTabs />
        <MonthSwitcher yearMonth={yearMonth} />

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs text-muted">고정 수입</p>
            <p className="tabular mt-1 text-lg font-bold text-income">
              {formatWon(expectedIncome)}
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs text-muted">고정 지출</p>
            <p className="tabular mt-1 text-lg font-bold text-expense">
              {formatWon(expectedExpense)}
            </p>
          </div>
        </div>

        {schedule.length > 0 && (
          <p className="text-center text-xs text-muted">
            {schedule.length}건 중 {paidCount}건 처리 완료
          </p>
        )}

        {schedule.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
            <p className="text-4xl">🗓️</p>
            <p className="mt-3 text-sm font-medium">
              아직 등록된 고정지출이 없어요
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              월급날, 카드 결제일, 아파트 관리비, 통신비처럼
              <br />
              매달 반복되는 항목을 등록해 두세요.
            </p>
            <Link
              href="/fixed/new"
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            >
              고정지출 등록하기
            </Link>
          </div>
        ) : (
          <FixedViews rows={rows} yearMonth={yearMonth} />
        )}
      </div>
    </>
  );
}
