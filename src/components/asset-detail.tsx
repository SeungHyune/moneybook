import Link from "next/link";
import { ChevronLeft, Pencil } from "lucide-react";
import { MonthSwitcher } from "@/components/month-switcher";
import {
  TransactionRow,
  type TransactionRowData,
} from "@/components/transaction-row";
import { formatRelativeDate, formatWon } from "@/lib/utils";

/**
 * 카드/계좌 상세 공용 레이아웃.
 * 월 선택 + 그 달 요약 + 그 자산의 내역만 날짜별로 보여준다.
 */
export function AssetDetail({
  title,
  subtitle,
  color,
  editHref,
  yearMonth,
  summaryItems,
  transactions,
  emptyMessage,
}: {
  title: string;
  subtitle?: string;
  color: string;
  editHref?: string;
  yearMonth: string;
  summaryItems: { label: string; value: string; tone?: "income" | "expense" }[];
  transactions: TransactionRowData[];
  emptyMessage: string;
}) {
  // 날짜별 묶음 (내역 탭과 같은 방식)
  const groups = new Map<string, TransactionRowData[]>();
  for (const transaction of transactions) {
    const key = transaction.occurredAt.toDateString();
    const list = groups.get(key) ?? [];
    list.push(transaction);
    groups.set(key, list);
  }

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="flex h-14 items-center gap-1 px-2">
          <Link
            href="/cards"
            aria-label="뒤로"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted active:bg-surface-muted"
          >
            <ChevronLeft className="size-5" />
          </Link>

          <span
            className="h-6 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden
          />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{title}</h1>
            {subtitle && (
              <p className="truncate text-xs text-muted">{subtitle}</p>
            )}
          </div>

          {editHref && (
            <Link
              href={editHref}
              aria-label="수정"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted active:bg-surface-muted"
            >
              <Pencil className="size-4" />
            </Link>
          )}
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        <MonthSwitcher yearMonth={yearMonth} />

        {/* 그 달 요약 */}
        <div
          className="grid gap-2 rounded-2xl border border-border bg-surface p-3 text-center"
          style={{
            gridTemplateColumns: `repeat(${summaryItems.length}, minmax(0, 1fr))`,
          }}
        >
          {summaryItems.map((item) => (
            <div key={item.label}>
              <p className="text-xs text-muted">{item.label}</p>
              <p
                className={`tabular text-sm font-bold ${
                  item.tone === "income"
                    ? "text-income"
                    : item.tone === "expense"
                      ? "text-expense"
                      : ""
                }`}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        {transactions.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface py-12 text-center">
            <p className="text-sm text-muted">{emptyMessage}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {[...groups.entries()].map(([dateKey, items]) => {
              const dayExpense = items.reduce(
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
                    {dayExpense > 0 && (
                      <span className="tabular text-xs text-muted">
                        지출 {formatWon(dayExpense)}
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
