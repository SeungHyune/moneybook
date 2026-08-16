import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CategoryIcon } from "@/components/category-icon";
import { MonthSwitcher } from "@/components/month-switcher";
import { FixedItemActions } from "@/components/fixed-item-actions";
import { requireHouseholdContext } from "@/lib/auth";
import { getFixedSchedule } from "@/lib/queries";
import {
  OCCURRENCE_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  RECURRING_KIND_META,
} from "@/lib/labels";
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

  return (
    <>
      <AppHeader
        title="고정지출"
        subtitle="매월 반복되는 수입과 지출"
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
          <ul className="space-y-2">
            {schedule.map((item) => {
              const meta = RECURRING_KIND_META[item.rule.kind];
              const isPaid = item.status === "PAID";
              const isSkipped = item.status === "SKIPPED";
              const isOverdue = item.status === "OVERDUE";

              const methodText = item.rule.card
                ? `${item.rule.card.name}${item.rule.card.last4 ? ` (${item.rule.card.last4})` : ""}`
                : item.rule.account
                  ? `${item.rule.account.bankName ?? ""} ${item.rule.account.name}`.trim()
                  : PAYMENT_METHOD_LABEL[item.rule.paymentMethod];

              return (
                <li
                  key={item.rule.id}
                  className={`rounded-2xl border border-border bg-surface p-4 ${
                    isSkipped ? "opacity-50" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <CategoryIcon
                      icon={meta.emoji}
                      color={meta.color}
                      size="lg"
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-bold">
                          {item.rule.name}
                        </p>
                        <span className="shrink-0 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">
                          {meta.label}
                        </span>
                      </div>

                      <p className="mt-0.5 truncate text-xs text-muted">
                        매월 {item.dueDate.getDate()}일 · {methodText}
                        {item.rule.isAmountVariable && " · 변동"}
                      </p>

                      <div className="mt-1 flex items-center gap-2">
                        <span
                          className={`tabular text-sm font-bold ${
                            item.rule.type === "INCOME"
                              ? "text-income"
                              : "text-foreground"
                          }`}
                        >
                          {item.rule.type === "INCOME" ? "+" : ""}
                          {formatWon(item.amount)}
                        </span>

                        <span
                          className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ${
                            isPaid
                              ? "bg-success/15 text-success"
                              : isOverdue
                                ? "bg-expense/15 text-expense"
                                : isSkipped
                                  ? "bg-surface-muted text-muted"
                                  : "bg-warning/15 text-warning"
                          }`}
                        >
                          {OCCURRENCE_STATUS_LABEL[item.status]}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isPaid && !isSkipped && (
                    <FixedItemActions
                      ruleId={item.rule.id}
                      yearMonth={yearMonth}
                      defaultAmount={item.rule.amount}
                      isAmountVariable={item.rule.isAmountVariable}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
