import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, CreditCard } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionRow } from "@/components/transaction-row";
import {
  SectionSkeleton,
  SummarySkeleton,
} from "@/components/ui/skeleton";
import { requireHouseholdContext } from "@/lib/auth";
import {
  getCardBillings,
  getCategoryBreakdown,
  getMonthlySummary,
  getTransactions,
  getUpcomingFixed,
} from "@/lib/queries";
import { RECURRING_KIND_META } from "@/lib/labels";
import {
  daysUntil,
  formatWon,
  formatWonShort,
  toYearMonth,
} from "@/lib/utils";

/**
 * 홈 화면.
 *
 * 섹션마다 Suspense 로 감싸서 각자 준비되는 대로 화면에 채워진다.
 * 예전에는 5개 쿼리를 전부 기다린 뒤 한 번에 그렸는데,
 * DB 왕복이 겹치면 그동안 빈 화면이라 느리게 느껴졌다.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { household } = await requireHouseholdContext();

  const params = await searchParams;
  const monthParam = params.month;
  const yearMonth =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : toYearMonth(new Date());

  const householdId = household.id;
  const monthStartDay = household.monthStartDay;

  return (
    <>
      <AppHeader title={household.name} showSettings />

      <div className="space-y-4 px-4 py-4">
        <MonthSwitcher yearMonth={yearMonth} />

        <Suspense fallback={<SummarySkeleton />}>
          <SummarySection
            householdId={householdId}
            yearMonth={yearMonth}
            monthStartDay={monthStartDay}
          />
        </Suspense>

        <Suspense fallback={<SectionSkeleton rows={3} />}>
          <UpcomingSection householdId={householdId} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton rows={2} />}>
          <CardBillingSection
            householdId={householdId}
            yearMonth={yearMonth}
          />
        </Suspense>

        <Suspense fallback={<SectionSkeleton rows={4} />}>
          <BreakdownSection
            householdId={householdId}
            yearMonth={yearMonth}
            monthStartDay={monthStartDay}
          />
        </Suspense>

        <Suspense fallback={<SectionSkeleton rows={3} />}>
          <RecentSection
            householdId={householdId}
            yearMonth={yearMonth}
            monthStartDay={monthStartDay}
          />
        </Suspense>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// 섹션들
// ---------------------------------------------------------------------------

async function SummarySection({
  householdId,
  yearMonth,
  monthStartDay,
}: {
  householdId: string;
  yearMonth: string;
  monthStartDay: number;
}) {
  const summary = await getMonthlySummary(householdId, yearMonth, monthStartDay);

  return (
    <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
      <p className="text-xs opacity-80">이번 달 남은 돈</p>
      <p className="tabular mt-1 text-3xl font-bold tracking-tight">
        {formatWon(summary.balance)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4">
        <div>
          <p className="text-xs opacity-80">수입</p>
          <p className="tabular text-lg font-bold">
            {formatWon(summary.income)}
          </p>
        </div>
        <div>
          <p className="text-xs opacity-80">지출</p>
          <p className="tabular text-lg font-bold">
            {formatWon(summary.expense)}
          </p>
        </div>
      </div>
    </section>
  );
}

async function UpcomingSection({ householdId }: { householdId: string }) {
  const upcoming = await getUpcomingFixed(householdId, 10);

  return (
    <SectionCard
      title="다가오는 일정"
      icon={<CalendarClock className="size-4" />}
      href="/fixed"
    >
      {upcoming.length === 0 ? (
        <EmptyHint
          message="예정된 고정지출이 없어요."
          actionLabel="고정지출 등록하기"
          href="/fixed/new"
        />
      ) : (
        <ul className="divide-y divide-border">
          {upcoming.slice(0, 4).map((item) => {
            const meta = RECURRING_KIND_META[item.rule.kind];
            const dday = daysUntil(item.dueDate);

            return (
              <li
                key={`${item.rule.id}-${item.dueDate.toISOString()}`}
                className="flex items-center gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span className="text-xl" aria-hidden>
                  {meta.emoji}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {item.rule.name}
                  </p>
                  <p className="text-xs text-muted">
                    {item.dueDate.getMonth() + 1}월 {item.dueDate.getDate()}일
                    {item.rule.isAmountVariable && " · 금액 변동"}
                  </p>
                </div>

                <div className="text-right">
                  <p
                    className={`tabular text-sm font-bold ${
                      item.rule.type === "INCOME"
                        ? "text-income"
                        : "text-foreground"
                    }`}
                  >
                    {item.rule.type === "INCOME" ? "+" : ""}
                    {formatWonShort(item.amount)}
                  </p>
                  <p
                    className={`text-xs ${
                      dday <= 2 ? "text-expense" : "text-muted"
                    }`}
                  >
                    {dday === 0 ? "오늘" : `D-${dday}`}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

async function CardBillingSection({
  householdId,
  yearMonth,
}: {
  householdId: string;
  yearMonth: string;
}) {
  const billings = await getCardBillings(householdId, yearMonth);

  const withAmount = billings.filter((item) => item.total > 0);
  const totalBilling = withAmount.reduce((sum, item) => sum + item.total, 0);

  return (
    <SectionCard
      title={`${Number(yearMonth.split("-")[1])}월 카드값`}
      icon={<CreditCard className="size-4" />}
      href="/cards"
      trailing={
        totalBilling > 0 ? (
          <span className="tabular text-sm font-bold">
            {formatWon(totalBilling)}
          </span>
        ) : undefined
      }
    >
      {withAmount.length === 0 ? (
        <EmptyHint
          message="이번 달 청구 예정인 카드값이 없어요."
          actionLabel="카드 등록하기"
          href="/cards/new"
        />
      ) : (
        <ul className="space-y-3">
          {withAmount.map(({ card, total, installment, period }) => (
            <li key={card.id} className="flex items-center gap-3">
              <span
                className="h-9 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: card.color }}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{card.name}</p>
                <p className="text-xs text-muted">
                  {period
                    ? `${period.billingDate.getDate()}일 결제`
                    : "결제일 미설정"}
                  {installment > 0 && ` · 할부 ${formatWonShort(installment)}`}
                </p>
              </div>
              <span className="tabular text-sm font-bold">
                {formatWon(total)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

async function BreakdownSection({
  householdId,
  yearMonth,
  monthStartDay,
}: {
  householdId: string;
  yearMonth: string;
  monthStartDay: number;
}) {
  const breakdown = await getCategoryBreakdown(
    householdId,
    yearMonth,
    monthStartDay,
  );

  if (breakdown.length === 0) return null;

  return (
    <SectionCard title="많이 쓴 곳" href="/transactions">
      <ul className="space-y-3">
        {breakdown.slice(0, 5).map((item) => (
          <li key={item.categoryId ?? "none"} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span aria-hidden>{item.icon}</span>
                <span className="truncate">{item.name}</span>
              </span>
              <span className="tabular shrink-0 font-medium">
                {formatWon(item.amount)}
              </span>
            </div>
            <div
              className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
              role="presentation"
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(item.ratio * 100, 2)}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </SectionCard>
  );
}

async function RecentSection({
  householdId,
  yearMonth,
  monthStartDay,
}: {
  householdId: string;
  yearMonth: string;
  monthStartDay: number;
}) {
  const recent = await getTransactions(householdId, {
    yearMonth,
    monthStartDay,
    take: 5,
  });

  return (
    <SectionCard title="최근 내역" href="/transactions">
      {recent.length === 0 ? (
        <EmptyHint
          message="아직 입력한 내역이 없어요."
          actionLabel="내역 등록하기"
          href="/transactions/new"
        />
      ) : (
        <ul className="divide-y divide-border">
          {recent.map((transaction) => (
            <TransactionRow key={transaction.id} transaction={transaction} />
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

// ---------------------------------------------------------------------------

function SectionCard({
  title,
  icon,
  href,
  trailing,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  href?: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-bold">
          {icon}
          {title}
        </h2>

        <div className="flex items-center gap-2">
          {trailing}
          {href && (
            <Link
              href={href}
              className="flex items-center text-xs text-muted"
              aria-label={`${title} 전체 보기`}
            >
              <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

function EmptyHint({
  message,
  actionLabel,
  href,
}: {
  message: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <div className="py-4 text-center">
      <p className="text-sm text-muted">{message}</p>
      <Link
        href={href}
        className="mt-2 inline-block text-sm font-medium text-primary"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
