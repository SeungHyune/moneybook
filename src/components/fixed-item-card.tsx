"use client";

import Link from "next/link";
import { Pencil } from "lucide-react";
import { CategoryIcon } from "@/components/category-icon";
import { FixedItemActions } from "@/components/fixed-item-actions";
import { OCCURRENCE_STATUS_LABEL, RECURRING_KIND_META } from "@/lib/labels";
import { formatWon } from "@/lib/utils";
import type { FixedRow } from "@/components/fixed-views";

/**
 * 고정지출 항목 한 줄.
 * 카테고리별 뷰와 전체 목록 뷰가 같은 모양을 쓰도록 따로 뺐다.
 */
export function FixedItemCard({
  row,
  yearMonth,
  /** 카테고리 안에서는 아이콘/뱃지가 중복이라 접는다 */
  compact = false,
}: {
  row: FixedRow;
  yearMonth: string;
  compact?: boolean;
}) {
  const meta = RECURRING_KIND_META[row.kind];
  const isPaid = row.status === "PAID";
  const isSkipped = row.status === "SKIPPED";
  const isOverdue = row.status === "OVERDUE";

  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-4 ${
        isSkipped ? "opacity-50" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        {!compact && (
          <CategoryIcon icon={meta.emoji} color={meta.color} size="lg" />
        )}

        {/* 눌러서 금액·날짜·받는 사람 같은 설정을 고친다 */}
        <Link
          href={`/fixed/${row.id}`}
          className="-my-1 min-w-0 flex-1 rounded-lg py-1 transition active:opacity-70"
        >
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-bold">{row.name}</p>
            {!compact && (
              <span className="shrink-0 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">
                {meta.label}
              </span>
            )}
            <Pencil className="size-3 shrink-0 text-muted" aria-hidden />
          </div>

          <p className="mt-0.5 truncate text-xs text-muted">
            {row.ownerName && `${row.ownerName} · `}
            매월 {row.dueDay}일 · {row.methodText}
            {row.isAmountVariable && " · 변동"}
          </p>

          <div className="mt-1 flex items-center gap-2">
            <span
              className={`tabular text-sm font-bold ${
                row.type === "INCOME" ? "text-income" : "text-foreground"
              }`}
            >
              {row.type === "INCOME" ? "+" : ""}
              {formatWon(row.amount)}
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
              {OCCURRENCE_STATUS_LABEL[row.status]}
            </span>
          </div>
        </Link>
      </div>

      {!isPaid && !isSkipped && (
        <FixedItemActions
          ruleId={row.id}
          yearMonth={yearMonth}
          defaultAmount={row.ruleAmount}
          isAmountVariable={row.isAmountVariable}
        />
      )}
    </div>
  );
}
