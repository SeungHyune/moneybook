"use client";

import { useState } from "react";
import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import { installmentLabel } from "@/lib/labels";
import { cn, formatRelativeDate, formatWon } from "@/lib/utils";

/**
 * 청구서 내역을 전체/일시불/할부 탭으로 나눠 보여준다.
 *
 * 할부는 "이번 청구서에 얼마가 잡혔는지"가 핵심이라 회차(3/12)와
 * 이번 달 몫을 함께 보여주고, 원래 결제 총액은 보조로 적는다.
 */

export type StatementItem = {
  id: string;
  round: number;
  totalRounds: number;
  /** 이번 청구서에 잡힌 금액 */
  amount: number;
  transaction: {
    id: string;
    amount: number;
    occurredAt: Date;
    merchant: string | null;
    memo: string | null;
    category: { name: string; icon: string | null; color: string } | null;
    payer: { displayName: string | null } | null;
  };
};

const TABS = [
  { key: "all", label: "전체" },
  { key: "lump", label: "일시불" },
  { key: "installment", label: "할부" },
] as const;

export function StatementTabs({
  lumpSumItems,
  installmentItems,
  lumpSum,
  installment,
}: {
  lumpSumItems: StatementItem[];
  installmentItems: StatementItem[];
  lumpSum: number;
  installment: number;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");

  const items =
    tab === "lump"
      ? lumpSumItems
      : tab === "installment"
        ? installmentItems
        : [...lumpSumItems, ...installmentItems].sort(
            (a, b) =>
              b.transaction.occurredAt.getTime() -
              a.transaction.occurredAt.getTime(),
          );

  const counts = {
    all: lumpSumItems.length + installmentItems.length,
    lump: lumpSumItems.length,
    installment: installmentItems.length,
  };

  return (
    <div className="space-y-3">
      {/* 일시불 / 할부 금액 요약 */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
        <button
          type="button"
          onClick={() => setTab("lump")}
          className={cn(
            "bg-surface px-4 py-3 text-left transition",
            tab === "lump" && "bg-primary/5",
          )}
        >
          <p className="text-[11px] text-muted">일시불</p>
          <p className="tabular text-sm font-bold">{formatWon(lumpSum)}</p>
        </button>
        <button
          type="button"
          onClick={() => setTab("installment")}
          className={cn(
            "bg-surface px-4 py-3 text-left transition",
            tab === "installment" && "bg-primary/5",
          )}
        >
          <p className="text-[11px] text-muted">할부</p>
          <p className="tabular text-sm font-bold">{formatWon(installment)}</p>
        </button>
      </div>

      {/* 탭 */}
      <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-1">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              "rounded-lg py-2 text-sm font-bold transition",
              tab === item.key
                ? "bg-surface text-foreground shadow-sm"
                : "text-muted",
            )}
          >
            {item.label}
            <span className="ml-1 text-xs font-normal opacity-70">
              {counts[item.key]}
            </span>
          </button>
        ))}
      </div>

      {/* 내역 */}
      {items.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface py-10 text-center">
          <p className="text-sm text-muted">
            {tab === "installment"
              ? "이번 청구서에 할부 건이 없어요."
              : tab === "lump"
                ? "이번 청구서에 일시불 건이 없어요."
                : "이번 청구서에 잡힌 결제가 없어요."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
          {items.map((item) => {
            const { transaction } = item;
            const isInstallment = item.totalRounds > 1;

            return (
              <li key={item.id} className="first:pt-0 last:pb-0">
                <Link
                  href={`/transactions/${transaction.id}/edit`}
                  className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition active:bg-surface-muted"
                >
                  <CategoryIcon
                    icon={transaction.category?.icon ?? "📌"}
                    color={transaction.category?.color ?? "#9ca3af"}
                    size="md"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {transaction.merchant ??
                        transaction.category?.name ??
                        "내역"}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {formatRelativeDate(transaction.occurredAt)}
                      {isInstallment && (
                        <>
                          {" · "}
                          <span className="text-primary">
                            {item.round}/{item.totalRounds}회차
                          </span>
                          {" · "}
                          원금 {formatWon(transaction.amount)}
                        </>
                      )}
                      {transaction.payer?.displayName &&
                        ` · ${transaction.payer.displayName}`}
                    </p>
                  </div>

                  <div className="shrink-0 text-right">
                    <p className="tabular text-sm font-bold">
                      {formatWon(item.amount)}
                    </p>
                    {isInstallment && (
                      <p className="text-[10px] text-muted">
                        {installmentLabel(item.totalRounds)}
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
