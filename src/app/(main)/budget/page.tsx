import Link from "next/link";
import { AlertTriangle, ArrowRight, Pencil, Plus, Target } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CategoryIcon } from "@/components/category-icon";
import { MonthSwitcher } from "@/components/month-switcher";
import { PlanTabs } from "@/components/plan-tabs";
import { requireHouseholdContext } from "@/lib/auth";
import {
  getBudgetOverview,
  getMonthProgress,
  getSavingsGoals,
} from "@/lib/queries";
import { formatWon, toYearMonth } from "@/lib/utils";

export const metadata = { title: "예산" };

export default async function BudgetPage({
  searchParams,
}: PageProps<"/budget">) {
  const { household } = await requireHouseholdContext();
  const params = await searchParams;

  const monthParam = params.month;
  const yearMonth =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : toYearMonth(new Date());

  const [overview, goals] = await Promise.all([
    getBudgetOverview(household.id, yearMonth, household.monthStartDay),
    getSavingsGoals(household.id),
  ]);

  // 이번 달이 얼마나 지났는지 — "오늘까지 이 정도면 적정" 의 기준
  const progress = getMonthProgress(yearMonth, household.monthStartDay);

  const limit = overview.monthlyLimit;
  const pace = limit === null ? null : Math.round(limit * progress.ratio);
  const diff = pace === null ? null : pace - overview.totalSpent;

  return (
    <>
      <AppHeader
        title="계획"
        subtitle="예산과 고정지출"
        action={
          <Link
            href={`/budget/edit?month=${yearMonth}`}
            aria-label="예산 수정"
            className="flex size-9 items-center justify-center rounded-full text-primary transition active:bg-surface-muted"
          >
            <Pencil className="size-4" />
          </Link>
        }
      />

      <div className="space-y-4 px-4 py-4">
        <PlanTabs />
        <MonthSwitcher yearMonth={yearMonth} />

        {!overview.hasAnyBudget ? (
          <div className="rounded-2xl border border-border bg-surface px-6 py-12 text-center">
            <p className="text-4xl">🎯</p>
            <p className="mt-3 text-sm font-medium">
              아직 정한 예산이 없어요
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              한 달에 얼마까지 쓸지 정해두면
              <br />
              홈에서 &ldquo;더 쓸 수 있는 돈&rdquo;을 알려드려요.
            </p>
            <Link
              href={`/budget/edit?month=${yearMonth}`}
              className="mt-4 inline-block rounded-xl bg-primary px-5 py-3 text-sm font-bold text-primary-foreground"
            >
              예산 정하기
            </Link>
          </div>
        ) : (
          <>
            {/* 월 전체 예산 */}
            {limit !== null && (
              <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
                <p className="text-xs opacity-80">이번 달 더 쓸 수 있는 돈</p>
                <p className="tabular mt-1 text-3xl font-bold tracking-tight">
                  {formatWon(Math.max(0, limit - overview.totalSpent))}
                </p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
                  <div
                    className="h-full rounded-full bg-white transition-all"
                    style={{
                      width: `${Math.min(100, (overview.totalSpent / limit) * 100)}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex items-baseline justify-between text-xs opacity-90">
                  <span className="tabular">
                    {formatWon(overview.totalSpent)} / {formatWon(limit)}
                  </span>
                  <span>{Math.round((overview.totalSpent / limit) * 100)}%</span>
                </div>

                {/* 페이스 — 지난 달을 볼 땐 의미가 없어 이번 달만 */}
                {progress.isCurrent && pace !== null && diff !== null && (
                  <p className="mt-3 border-t border-white/20 pt-3 text-xs opacity-90">
                    오늘까지 적정 {formatWon(pace)} ·{" "}
                    {diff >= 0
                      ? `${formatWon(diff)} 아끼고 있어요`
                      : `${formatWon(-diff)} 더 썼어요`}
                    {progress.daysLeft > 0 && ` · ${progress.daysLeft}일 남음`}
                  </p>
                )}
              </section>
            )}

            {/*
              미분류가 크면 카테고리 진행률이 거짓말을 한다 —
              식비 한도를 지킨 것처럼 보여도 실제 식비가 미분류에 숨어 있을 수 있다.
            */}
            {overview.uncategorized &&
              overview.uncategorized.ratio > 0.1 && (
                <Link
                  href="/transactions?category=none"
                  className="flex items-center gap-3 rounded-2xl bg-warning/10 px-4 py-3 transition active:brightness-95"
                >
                  <AlertTriangle className="size-5 shrink-0 text-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-warning">
                      미분류 {formatWon(overview.uncategorized.amount)}
                    </p>
                    <p className="text-xs text-warning/80">
                      이번 달 지출의 {Math.round(overview.uncategorized.ratio * 100)}
                      %가 어느 항목인지 정해지지 않았어요
                    </p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-warning" />
                </Link>
              )}

            {overview.isInherited && (
              <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-muted">
                지난달에 정한 예산을 그대로 쓰고 있어요. 이번 달만 다르게
                하려면 예산 수정에서 금액을 바꾸면 됩니다.
              </p>
            )}

            {/* 카테고리별 */}
            <section className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h2 className="text-sm font-bold">카테고리별</h2>
                {limit !== null && (
                  <span className="text-xs text-muted">
                    배정 {formatWon(overview.assigned)} / {formatWon(limit)}
                  </span>
                )}
              </div>

              <ul className="space-y-2">
                {overview.items
                  .filter((item) => item.limit !== null || item.spent > 0)
                  .map((item) => {
                    const over =
                      item.limit !== null && item.spent > item.limit;
                    const ratio = item.ratio ?? 0;

                    return (
                      <li
                        key={item.categoryId}
                        className="rounded-2xl border border-border bg-surface p-4"
                      >
                        <div className="flex items-center gap-3">
                          <CategoryIcon
                            icon={item.icon}
                            color={item.color}
                            size="md"
                          />

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold">
                              {item.name}
                            </p>
                            <p className="text-xs text-muted">
                              {item.limit === null
                                ? "한도 없음"
                                : over
                                  ? `${formatWon(item.spent - item.limit)} 초과`
                                  : `${formatWon(item.limit - item.spent)} 남음`}
                            </p>
                          </div>

                          <div className="shrink-0 text-right">
                            <p
                              className={`tabular text-sm font-bold ${over ? "text-expense" : ""}`}
                            >
                              {formatWon(item.spent)}
                            </p>
                            {item.limit !== null && (
                              <p className="text-[10px] text-muted">
                                / {formatWon(item.limit)}
                              </p>
                            )}
                          </div>
                        </div>

                        {item.limit !== null && (
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(100, ratio * 100)}%`,
                                backgroundColor: over
                                  ? "var(--color-expense)"
                                  : item.color,
                              }}
                            />
                          </div>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          </>
        )}

        {/* 저축 목표 */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="flex items-center gap-1.5 text-sm font-bold">
              <Target className="size-4" />
              저축 목표
            </h2>
            <Link
              href="/budget/goals/new"
              aria-label="목표 추가"
              className="flex size-8 items-center justify-center rounded-full text-primary transition active:bg-surface-muted"
            >
              <Plus className="size-4" />
            </Link>
          </div>

          {goals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
              <p className="text-sm text-muted">아직 저축 목표가 없어요.</p>
              <Link
                href="/budget/goals/new"
                className="mt-2 inline-block text-sm font-medium text-primary"
              >
                목표 만들기
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {goals.map((goal) => (
                <li key={goal.id}>
                  <Link
                    href={`/budget/goals/${goal.id}`}
                    className="block rounded-2xl border border-border bg-surface p-4 transition active:bg-surface-muted"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate text-sm font-bold">{goal.name}</p>
                      <p className="tabular shrink-0 text-sm font-bold">
                        {formatWon(goal.saved)}
                      </p>
                    </div>

                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-success"
                        style={{ width: `${Math.max(goal.ratio * 100, 1)}%` }}
                      />
                    </div>

                    <div className="mt-1.5 flex items-baseline justify-between text-xs text-muted">
                      <span>
                        목표 {formatWon(goal.targetAmount)}
                        {goal.targetDate &&
                          ` · ${goal.targetDate.getFullYear()}년 ${goal.targetDate.getMonth() + 1}월까지`}
                      </span>
                      <span>{Math.round(goal.ratio * 100)}%</span>
                    </div>

                    {!goal.account && (
                      <p className="mt-1.5 text-[11px] text-warning">
                        연결된 저축 계좌가 없어 금액이 자동으로 안 늘어요
                      </p>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
