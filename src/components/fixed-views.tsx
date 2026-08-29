"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { FixedItemCard } from "@/components/fixed-item-card";
import { RECURRING_KIND_META } from "@/lib/labels";
import { cn, formatWon } from "@/lib/utils";
import type { OccurrenceStatus, RecurringKind } from "@/generated/prisma/enums";

/**
 * 고정 수입/지출을 두 가지로 본다.
 *
 *  - 카테고리별: 통신비·구독료처럼 "무엇에 매달 얼마가 나가는지"를 먼저 본다.
 *    금액 큰 순으로 세워 어디를 줄여야 할지 바로 보이게 했다.
 *  - 전체 목록: 예정일 순으로 전부 나열한다. 이번 달 처리하려고 볼 때 쓴다.
 */

export type FixedRow = {
  id: string;
  name: string;
  kind: RecurringKind;
  type: "INCOME" | "EXPENSE";
  /** 이번 달 실제 금액 (확정됐으면 확정액) */
  amount: number;
  /** 규칙에 적힌 예상 금액 — 확인 폼의 기본값 */
  ruleAmount: number;
  dueDay: number;
  methodText: string;
  isAmountVariable: boolean;
  status: OccurrenceStatus;
  /** 누구 항목인지 — 부부가 같은 은행을 쓰면 이름만으론 구분이 안 된다 */
  ownerName: string | null;
};

export function FixedViews({
  rows,
  yearMonth,
}: {
  rows: FixedRow[];
  yearMonth: string;
}) {
  const [view, setView] = useState<"category" | "list">("category");
  const [openKinds, setOpenKinds] = useState<string[]>([]);

  const expense = rows.filter((row) => row.type === "EXPENSE");
  const income = rows.filter((row) => row.type === "INCOME");

  function toggle(kind: string) {
    setOpenKinds((current) =>
      current.includes(kind)
        ? current.filter((item) => item !== kind)
        : [...current, kind],
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
        {(
          [
            { key: "category", label: "카테고리별" },
            { key: "list", label: "전체 목록" },
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

      {view === "list" ? (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.id}>
              <FixedItemCard row={row} yearMonth={yearMonth} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="space-y-4">
          <KindGroups
            rows={expense}
            title="매달 나가는 돈"
            yearMonth={yearMonth}
            openKinds={openKinds}
            onToggle={toggle}
          />
          <KindGroups
            rows={income}
            title="매달 들어오는 돈"
            yearMonth={yearMonth}
            openKinds={openKinds}
            onToggle={toggle}
            isIncome
          />
        </div>
      )}
    </div>
  );
}

function KindGroups({
  rows,
  title,
  yearMonth,
  openKinds,
  onToggle,
  isIncome = false,
}: {
  rows: FixedRow[];
  title: string;
  yearMonth: string;
  openKinds: string[];
  onToggle: (kind: string) => void;
  isIncome?: boolean;
}) {
  if (rows.length === 0) return null;

  // 같은 kind 끼리 묶고 금액이 큰 순으로 세운다
  const groups = [...new Set(rows.map((row) => row.kind))]
    .map((kind) => {
      const items = rows.filter((row) => row.kind === kind);
      return {
        kind,
        items,
        total: items.reduce((sum, row) => sum + row.amount, 0),
        doneCount: items.filter((row) => row.status === "PAID").length,
      };
    })
    .sort((a, b) => b.total - a.total);

  const grandTotal = groups.reduce((sum, group) => sum + group.total, 0);

  return (
    <section className="space-y-2">
      <div className="flex items-baseline justify-between px-1">
        <h2 className="text-sm font-bold">{title}</h2>
        <span
          className={cn(
            "tabular text-sm font-bold",
            isIncome ? "text-income" : "text-expense",
          )}
        >
          {isIncome ? "+" : ""}
          {formatWon(grandTotal)}
        </span>
      </div>

      <ul className="space-y-2">
        {groups.map((group) => {
          const meta = RECURRING_KIND_META[group.kind];
          const isOpen = openKinds.includes(group.kind);
          // 0원 그룹만 있을 때 NaN 이 되지 않게 막는다
          const share = grandTotal > 0 ? (group.total / grandTotal) * 100 : 0;

          return (
            <li
              key={group.kind}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <button
                type="button"
                onClick={() => onToggle(group.kind)}
                aria-expanded={isOpen}
                className="w-full px-4 py-3 text-left transition active:bg-surface-muted"
              >
                <div className="flex items-center gap-3">
                  <CategoryIcon
                    icon={meta.emoji}
                    color={meta.color}
                    size="md"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{meta.label}</p>
                    <p className="text-xs text-muted">
                      {group.items.length}건
                      {group.doneCount > 0 &&
                        ` · ${group.doneCount}건 처리 완료`}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-bold">
                      {formatWon(group.total)}
                    </p>
                    <p className="text-[10px] text-muted">
                      {Math.round(share)}%
                    </p>
                  </div>

                  <ChevronDown
                    className={cn(
                      "size-4 shrink-0 text-muted transition-transform",
                      isOpen && "rotate-180",
                    )}
                    aria-hidden
                  />
                </div>

                {/* 어디에 많이 나가는지 한눈에 보라고 넣은 막대 */}
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(share, 2)}%`,
                      backgroundColor: meta.color,
                    }}
                  />
                </div>
              </button>

              {isOpen && (
                <ul className="space-y-2 border-t border-border bg-surface-muted/40 p-3">
                  {group.items.map((row) => (
                    <li key={row.id}>
                      <FixedItemCard row={row} yearMonth={yearMonth} compact />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
