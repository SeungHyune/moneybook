"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { OUTFLOW_GROUPS, type OutflowGroupKey } from "@/lib/labels";
import { cn, formatWon } from "@/lib/utils";

/**
 * 앞으로 나갈 돈을 두 가지로 본다.
 *
 *  - 날짜순: 언제 얼마가 빠지고 그때 얼마가 남는지 따라간다.
 *  - 분류별: 카드 결제·구독·보험처럼 성격이 같은 것끼리 묶어 덩어리를 본다.
 *    "매달 구독료로 얼마 나가지" 같은 건 날짜순으로는 안 보인다.
 */

export type OutflowRow = {
  key: string;
  group: OutflowGroupKey;
  name: string;
  note: string;
  emoji: string;
  color: string;
  /** 나갈 돈은 음수, 들어올 돈은 양수 */
  amount: number;
  dateLabel: string;
  ddayLabel: string;
  isUrgent: boolean;
  /** 이 건까지 처리하면 남는 돈 */
  running: number;
  href: string;
};

export function OutflowViews({ rows }: { rows: OutflowRow[] }) {
  const [view, setView] = useState<"date" | "group">("date");
  const [openGroups, setOpenGroups] = useState<string[]>([]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
        {(
          [
            { key: "date", label: "날짜순" },
            { key: "group", label: "분류별" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setView(tab.key)}
            className={cn(
              "rounded-lg py-2 text-sm font-bold transition",
              view === tab.key
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "date" ? (
        <>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
            {rows.map((row) => (
              <li key={row.key}>
                <Row row={row} showRunning />
              </li>
            ))}
          </ul>
          <p className="px-1 text-[11px] leading-relaxed text-muted">
            &ldquo;남음&rdquo;은 지금 가진 돈에서 이 건까지 순서대로 더하고 뺀
            값이에요. 중간에 마이너스가 되면 그 시점에 돈이 모자란다는
            뜻입니다.
          </p>
        </>
      ) : (
        <ul className="space-y-2">
          {OUTFLOW_GROUPS.map((group) => {
            const items = rows.filter((row) => row.group === group.key);
            if (items.length === 0) return null;

            const isIncome = group.key === "INCOME";
            const total = items.reduce(
              (sum, row) => sum + Math.abs(row.amount),
              0,
            );
            const isOpen = openGroups.includes(group.key);

            return (
              <li
                key={group.key}
                className="overflow-hidden rounded-2xl border border-border bg-surface"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((current) =>
                      current.includes(group.key)
                        ? current.filter((item) => item !== group.key)
                        : [...current, group.key],
                    )
                  }
                  aria-expanded={isOpen}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-surface-muted"
                >
                  <span className="text-xl" aria-hidden>
                    {group.emoji}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{group.label}</p>
                    <p className="text-xs text-muted">{items.length}건</p>
                  </div>

                  <span
                    className={cn(
                      "tabular shrink-0 text-sm font-bold",
                      isIncome && "text-income",
                    )}
                  >
                    {isIncome ? "+" : "−"}
                    {formatWon(total)}
                  </span>

                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </button>

                {isOpen && (
                  <ul className="divide-y divide-border border-t border-border bg-surface-muted/40 px-4">
                    {items.map((row) => (
                      <li key={row.key}>
                        <Row row={row} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Row({ row, showRunning = false }: { row: OutflowRow; showRunning?: boolean }) {
  return (
    <Link
      href={row.href as "/fixed"}
      className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition active:bg-surface-muted"
    >
      <CategoryIcon icon={row.emoji} color={row.color} size="md" />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{row.name}</p>
        <p className="truncate text-xs text-muted">
          {row.dateLabel} · {row.note}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cn(
            "tabular text-sm font-bold",
            row.amount > 0 && "text-income",
          )}
        >
          {row.amount > 0 ? "+" : "−"}
          {formatWon(Math.abs(row.amount))}
        </p>
        {showRunning ? (
          <p
            className={cn(
              "text-[11px]",
              row.running < 0 ? "text-expense" : "text-muted",
            )}
          >
            남음 {formatWon(row.running)}
          </p>
        ) : (
          <p
            className={cn(
              "text-[11px]",
              row.isUrgent ? "text-expense" : "text-muted",
            )}
          >
            {row.ddayLabel}
          </p>
        )}
      </div>
    </Link>
  );
}
