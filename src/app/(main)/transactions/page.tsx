import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { MemberFilter } from "@/components/member-filter";
import { MonthSwitcher } from "@/components/month-switcher";
import { TransactionRow } from "@/components/transaction-row";
import { requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMemberFilter } from "@/lib/member-filter";
import {
  getHouseholdMembers,
  getMonthlySummary,
  getTransactions,
} from "@/lib/queries";
import { formatRelativeDate, formatWon, toYearMonth } from "@/lib/utils";

export const metadata = { title: "내역" };

const FILTERS = [
  { value: "", label: "전체" },
  { value: "EXPENSE", label: "지출" },
  { value: "INCOME", label: "수입" },
  { value: "TRANSFER", label: "이체" },
] as const;

export default async function TransactionsPage({
  searchParams,
}: PageProps<"/transactions">) {
  const { household } = await requireHouseholdContext();
  const params = await searchParams;

  const monthParam = params.month;
  const yearMonth =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : toYearMonth(new Date());

  /*
   * 카테고리 필터. "none" 은 미분류(예산 화면의 "미분류 정리하기"),
   * uuid 면 그 카테고리 — 홈/예산의 카테고리 줄을 눌러서 들어온다.
   */
  const categoryParam =
    typeof params.category === "string" ? params.category : undefined;
  const onlyUncategorized = categoryParam === "none";

  const typeParam = params.type;
  const type =
    typeParam === "EXPENSE" || typeParam === "INCOME" || typeParam === "TRANSFER"
      ? typeParam
      : undefined;

  const [filterMember, members] = await Promise.all([
    getMemberFilter(household.id),
    getHouseholdMembers(household.id),
  ]);
  const memberId = filterMember?.id ?? null;

  // 배너에 쓸 카테고리 이름 (uuid 로 거른 경우)
  const filterCategory =
    categoryParam && categoryParam !== "none"
      ? await prisma.category.findFirst({
          where: { id: categoryParam, householdId: household.id },
          select: { name: true },
        })
      : null;
  const filterCategoryName = filterCategory?.name ?? null;

  const [summary, transactions] = await Promise.all([
    getMonthlySummary(
      household.id,
      yearMonth,
      household.monthStartDay,
      memberId,
      categoryParam,
    ),
    getTransactions(household.id, {
      yearMonth,
      monthStartDay: household.monthStartDay,
      type,
      take: 200,
      payerMemberId: memberId,
      ...(categoryParam ? { categoryId: categoryParam } : {}),
    }),
  ]);

  // 날짜별로 묶어서 보여준다
  const groups = new Map<string, typeof transactions>();
  for (const transaction of transactions) {
    const key = transaction.occurredAt.toDateString();
    const list = groups.get(key) ?? [];
    list.push(transaction);
    groups.set(key, list);
  }

  return (
    <>
      <AppHeader
        title={
          <MemberFilter
            householdName="내역"
            members={members}
            selectedId={memberId}
          />
        }
        showSettings
      />

      <div className="space-y-4 px-4 py-4">
        <MonthSwitcher yearMonth={yearMonth} />

        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-3 text-center">
          <div>
            <p className="text-xs text-muted">수입</p>
            <p className="tabular text-sm font-bold text-income">
              {formatWon(summary.income)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">지출</p>
            <p className="tabular text-sm font-bold text-expense">
              {formatWon(summary.expense)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">합계</p>
            <p className="tabular text-sm font-bold">
              {formatWon(summary.balance)}
            </p>
          </div>
        </div>

        {/* 걸러 보는 중이면 무엇으로 걸렀는지, 어떻게 풀지 알려준다 */}
        {categoryParam && (
          <div
            className={`flex items-center justify-between gap-2 rounded-2xl px-4 py-3 ${
              onlyUncategorized ? "bg-warning/10" : "bg-surface-muted"
            }`}
          >
            <p
              className={`min-w-0 truncate text-sm font-medium ${
                onlyUncategorized ? "text-warning" : ""
              }`}
            >
              {onlyUncategorized
                ? "카테고리를 안 정한 내역만 보고 있어요"
                : `${filterCategoryName ?? "선택한 항목"} 내역만 보고 있어요`}
            </p>
            <Link
              href={`/transactions?month=${yearMonth}`}
              className={`shrink-0 text-xs underline underline-offset-2 ${
                onlyUncategorized ? "text-warning" : "text-muted"
              }`}
            >
              전체 보기
            </Link>
          </div>
        )}

        {/* 종류 필터 */}
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {FILTERS.map((filter) => {
            const isActive = (type ?? "") === filter.value;
            const query = new URLSearchParams({ month: yearMonth });
            if (filter.value) query.set("type", filter.value);
            if (categoryParam) query.set("category", categoryParam);

            return (
              <Link
                key={filter.value || "all"}
                href={`/transactions?${query.toString()}`}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "bg-surface text-muted"
                }`}
              >
                {filter.label}
              </Link>
            );
          })}
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface py-12 text-center">
            <p className="text-sm text-muted">이 달에는 내역이 없어요.</p>
            <Link
              href="/transactions/new"
              className="mt-2 inline-block text-sm font-medium text-primary"
            >
              내역 등록하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {[...groups.entries()].map(([dateKey, items]) => {
              const dayTotal = items.reduce(
                (sum, item) =>
                  item.type === "EXPENSE" ? sum + item.amount : sum,
                0,
              );

              return (
                <section
                  key={dateKey}
                  className="rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-xs font-bold text-muted">
                      {formatRelativeDate(new Date(dateKey))}
                    </h2>
                    {dayTotal > 0 && (
                      <span className="tabular text-xs text-muted">
                        지출 {formatWon(dayTotal)}
                      </span>
                    )}
                  </div>

                  <ul className="divide-y divide-border">
                    {items.map((transaction) => (
                      <TransactionRow
                        key={transaction.id}
                        transaction={transaction}
                      />
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
