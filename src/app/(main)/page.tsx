import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight, Camera, TrendingDown } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CategoryIcon } from "@/components/category-icon";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionRow } from "@/components/transaction-row";
import { TutorialOverlay } from "@/components/tutorial-overlay";
import {
  SectionSkeleton,
  SummarySkeleton,
} from "@/components/ui/skeleton";
import { requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MemberFilter } from "@/components/member-filter";
import { getMemberFilter } from "@/lib/member-filter";
import {
  getBudgetOverview,
  getCategoryBreakdown,
  getHomeHero,
  getHouseholdMembers,
  getTransactions,
  getCashflowHorizon,
} from "@/lib/queries";
import { formatWon, formatWonShort, toYearMonth } from "@/lib/utils";

/**
 * 홈 화면.
 *
 * 섹션마다 Suspense 로 감싸서 각자 준비되는 대로 화면에 채워진다.
 * 예전에는 5개 쿼리를 전부 기다린 뒤 한 번에 그렸는데,
 * DB 왕복이 겹치면 그동안 빈 화면이라 느리게 느껴졌다.
 */
export default async function HomePage({ searchParams }: PageProps<"/">) {
  const { household, user } = await requireHouseholdContext();

  const params = await searchParams;
  const monthParam = params.month;
  const yearMonth =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : toYearMonth(new Date());

  const householdId = household.id;
  const monthStartDay = household.monthStartDay;

  // 헤더에서 고른 "누구 기준으로 볼지" (null = 전체 합산)
  const [filterMember, members] = await Promise.all([
    getMemberFilter(householdId),
    getHouseholdMembers(householdId),
  ]);
  const memberId = filterMember?.id ?? null;

  // 처음 온 사용자거나(tutorialSeenAt 없음) "다시 보기"(/?tutorial=1)로 연 경우
  const forceTutorial = params.tutorial === "1";
  const showTutorial = forceTutorial || user.tutorialSeenAt === null;

  return (
    <>
      {showTutorial && <TutorialOverlay forceOpen={forceTutorial} />}

      <AppHeader
        title={
          <MemberFilter
            householdName={household.name}
            members={members}
            selectedId={memberId}
          />
        }
        action={
          <Link
            href="/inbox"
            aria-label="영수증 스캔 / 자동 수집함"
            className="flex size-9 items-center justify-center rounded-full text-muted transition active:bg-surface-muted"
          >
            <Camera className="size-5" />
          </Link>
        }
        showSettings
      />

      <div className="space-y-4 px-4 py-4">
        <MonthSwitcher yearMonth={yearMonth} />

        <Suspense fallback={null}>
          <InboxBanner userId={user.id} />
        </Suspense>

        <Suspense fallback={<SummarySkeleton />}>
          <HeroSection
            householdId={householdId}
            yearMonth={yearMonth}
            monthStartDay={monthStartDay}
            memberId={memberId}
          />
        </Suspense>

        <Suspense fallback={<SectionSkeleton rows={4} />}>
          <OutflowSection householdId={householdId} memberId={memberId} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton rows={4} />}>
          <BreakdownSection
            householdId={householdId}
            yearMonth={yearMonth}
            monthStartDay={monthStartDay}
            memberId={memberId}
          />
        </Suspense>

        <Suspense fallback={<SectionSkeleton rows={3} />}>
          <RecentSection
            householdId={householdId}
            yearMonth={yearMonth}
            monthStartDay={monthStartDay}
            memberId={memberId}
          />
        </Suspense>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// 섹션들
// ---------------------------------------------------------------------------

/** 자동 수집함에 확인할 게 있으면 알려준다 */
async function InboxBanner({ userId }: { userId: string }) {
  const count = await prisma.ingestInbox.count({
    where: { userId, status: { in: ["PENDING", "FAILED"] } },
  });

  if (count === 0) return null;

  return (
    <Link
      href="/inbox"
      className="flex items-center justify-between gap-2 rounded-2xl bg-warning/10 px-4 py-3 text-sm font-medium text-warning transition active:brightness-95"
    >
      <span>확인할 자동 수집 내역 {count}건</span>
      <ArrowRight className="size-4 shrink-0" />
    </Link>
  );
}

/**
 * 홈 맨 위.
 *
 * 예산을 정했으면 "이번 달 더 쓸 수 있는 돈", 아니면 "다 내고 남는 돈".
 * 예전엔 수입 − 지출을 보여줬는데, 앞으로 나갈 카드값이 안 빠진 값이라
 * "더 써도 되나" 에 답을 못 했다.
 */
async function HeroSection({
  householdId,
  yearMonth,
  monthStartDay,
  memberId,
}: {
  householdId: string;
  yearMonth: string;
  monthStartDay: number;
  memberId: string | null;
}) {
  const hero = await getHomeHero(
    householdId,
    yearMonth,
    monthStartDay,
    memberId,
  );

  const isBudget = hero.mode === "BUDGET";
  const isShort = hero.amount < 0;

  return (
    <section className="space-y-3">
      <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
        <p className="text-xs opacity-80">
          {isBudget ? "이번 달 더 쓸 수 있는 돈" : "다 내고 남는 돈"}
        </p>
        <p className="tabular mt-1 text-3xl font-bold tracking-tight">
          {formatWon(hero.amount)}
        </p>

        {isBudget && hero.limit !== null ? (
          <>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${Math.min(100, (hero.spent / hero.limit) * 100)}%`,
                }}
              />
            </div>
            <div className="mt-2 flex items-baseline justify-between text-xs opacity-90">
              <span className="tabular">
                {formatWon(hero.spent)} / {formatWon(hero.limit)}
              </span>
              <span>{Math.round((hero.spent / hero.limit) * 100)}%</span>
            </div>

            {hero.isCurrentMonth && hero.paceDiff !== null && (
              <p className="mt-3 border-t border-white/20 pt-3 text-xs opacity-90">
                {hero.paceDiff >= 0
                  ? `${formatWon(hero.paceDiff)} 아끼고 있어요`
                  : `적정보다 ${formatWon(-hero.paceDiff)} 더 썼어요`}
                {hero.daysLeft > 0 && ` · ${hero.daysLeft}일 남음`}
                {hero.fixedLeft > 0 &&
                  ` · 남은 고정지출 ${formatWonShort(hero.fixedLeft)} 뺀 금액`}
              </p>
            )}
          </>
        ) : (
          <p className="mt-3 border-t border-white/20 pt-3 text-xs opacity-90">
            가진 돈 {formatWonShort(hero.assets.total)}
            {hero.comingTotal > 0 &&
              ` + 들어올 돈 ${formatWonShort(hero.comingTotal)}`}{" "}
            − 나갈 돈 {formatWonShort(hero.dueTotal)}
            {isShort && " · 이대로면 모자라요"}
          </p>
        )}
      </div>

      {/* 한 줄 요약 타일 — 눌러서 각 화면으로 */}
      <div className="grid grid-cols-3 gap-2">
        <Tile
          href="/cards"
          label="가진 돈"
          value={formatWonShort(hero.assets.total)}
        />
        <Tile
          href="/budget"
          label="이번 달 쓴 돈"
          value={formatWonShort(hero.spent)}
        />
        <Tile
          href="/transactions"
          label="이번 달 번 돈"
          value={formatWonShort(hero.summary.income)}
          tone="income"
        />
      </div>

      {/* 예산이 없을 때만 권한다 — 있으면 위에서 이미 보여주고 있다 */}
      {!isBudget && (
        <Link
          href="/budget/edit"
          className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-border px-4 py-3 text-sm transition active:bg-surface-muted"
        >
          <span className="text-muted">
            한 달 예산을 정하면 얼마나 더 써도 되는지 알려드려요
          </span>
          <ArrowRight className="size-4 shrink-0 text-muted" />
        </Link>
      )}
    </section>
  );
}

function Tile({
  href,
  label,
  value,
  tone,
}: {
  href: "/cards" | "/budget" | "/transactions";
  label: string;
  value: string;
  tone?: "income";
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-surface px-3 py-3 transition active:bg-surface-muted"
    >
      <p className="truncate text-[11px] text-muted">{label}</p>
      <p
        className={`tabular mt-0.5 truncate text-sm font-bold ${tone === "income" ? "text-income" : ""}`}
      >
        {value}
      </p>
    </Link>
  );
}

/**
 * 곧 나갈 돈 — 고정지출과 카드 결제를 한 리스트로.
 * 나뉘어 있으면 "이번에 총 얼마 나가지" 를 눈으로 더해야 했다.
 */
async function OutflowSection({
  householdId,
  memberId,
}: {
  householdId: string;
  memberId: string | null;
}) {
  const { outflows, outTotal: total, mergedIntoCard } =
    await getCashflowHorizon(householdId, memberId);

  return (
    <SectionCard
      title="곧 나갈 돈"
      icon={<TrendingDown className="size-4" />}
      trailing={
        total > 0 ? (
          <span className="tabular text-sm font-bold">{formatWon(total)}</span>
        ) : undefined
      }
    >
      {outflows.length === 0 ? (
        <EmptyHint
          message="3주 안에 나갈 돈이 없어요."
          actionLabel="고정지출 등록하기"
          href="/fixed/new"
        />
      ) : (
        <ul className="divide-y divide-border">
          {outflows.slice(0, 6).map((item) => (
            <li key={item.key}>
              <Link
                href={item.href}
                className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition active:bg-surface-muted"
              >
                <CategoryIcon
                  icon={item.emoji}
                  color={item.color}
                  size="md"
                />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <p className="truncate text-xs text-muted">
                    {item.date.getMonth() + 1}/{item.date.getDate()} ·{" "}
                    {item.note}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tabular text-sm font-bold">
                    {formatWonShort(item.amount)}
                  </p>
                  <p
                    className={`text-xs ${
                      item.isOverdue || item.dday <= 2
                        ? "text-expense"
                        : "text-muted"
                    }`}
                  >
                    {item.isOverdue
                      ? `${-item.dday}일 밀림`
                      : item.dday === 0
                        ? "오늘"
                        : `D-${item.dday}`}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {mergedIntoCard > 0 && (
        <p className="mt-3 border-t border-border pt-2.5 text-[11px] leading-relaxed text-muted">
          신용카드로 내는 고정지출 {formatWonShort(mergedIntoCard)}은 카드
          청구액에 이미 포함돼 있어요.
        </p>
      )}
    </SectionCard>
  );
}

/**
 * 카테고리별 지출.
 * 한도를 정해뒀으면 예산 진행률로, 아니면 그냥 많이 쓴 순서로 보여준다.
 * 한도가 없으면 "식비 55만" 이 많은 건지 알 수가 없다.
 */
async function BreakdownSection({
  householdId,
  yearMonth,
  monthStartDay,
  memberId,
}: {
  householdId: string;
  yearMonth: string;
  monthStartDay: number;
  memberId: string | null;
}) {
  const [breakdown, budget] = await Promise.all([
    getCategoryBreakdown(householdId, yearMonth, monthStartDay, memberId),
    getBudgetOverview(householdId, yearMonth, monthStartDay, memberId),
  ]);

  if (breakdown.length === 0) return null;

  const budgeted = budget.items.filter((item) => item.limit !== null);

  if (budgeted.length > 0) {
    return (
      <SectionCard title="예산 쓴 만큼" href="/budget">
        <ul className="space-y-3">
          {budgeted.slice(0, 5).map((item) => {
            const over = item.limit !== null && item.spent > item.limit;

            return (
              <li key={item.categoryId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <CategoryIcon
                      icon={item.icon}
                      color={item.color}
                      size="sm"
                    />
                    <span className="truncate">{item.name}</span>
                  </span>
                  <span
                    className={`tabular shrink-0 text-xs ${over ? "font-bold text-expense" : "text-muted"}`}
                  >
                    {formatWonShort(item.spent)} /{" "}
                    {formatWonShort(item.limit ?? 0)}
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-surface-muted"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.max((item.ratio ?? 0) * 100, 2))}%`,
                      backgroundColor: over
                        ? "var(--color-expense)"
                        : item.color,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </SectionCard>
    );
  }

  return (
    <SectionCard title="많이 쓴 곳" href="/transactions">
      <ul className="space-y-3">
        {breakdown.slice(0, 5).map((item) => (
          <li key={item.categoryId ?? "none"} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <CategoryIcon icon={item.icon} color={item.color} size="sm" />
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
  memberId,
}: {
  householdId: string;
  yearMonth: string;
  monthStartDay: number;
  memberId: string | null;
}) {
  const recent = await getTransactions(householdId, {
    yearMonth,
    monthStartDay,
    take: 5,
    payerMemberId: memberId,
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
