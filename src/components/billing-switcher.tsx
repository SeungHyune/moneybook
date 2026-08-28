"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { formatWonShort } from "@/lib/utils";

export type BillingOption = {
  /** "2026-08" */
  yearMonth: string;
  /** 결제일 표시용 */
  label: string;
  /** 그 청구서 총액 */
  amount: number;
  isPaid: boolean;
};

/**
 * 신용카드 상세의 청구서 선택.
 * "8월 25일 결제 · 45만원" 처럼 회차별로 골라 본다.
 */
export function BillingSwitcher({
  options,
  value,
}: {
  options: BillingOption[];
  value: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function choose(yearMonth: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("bill", yearMonth);
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(event) => choose(event.target.value)}
        aria-label="결제 회차 선택"
        className="appearance-none rounded-xl border border-border bg-surface py-2.5 pl-4 pr-9 text-sm font-bold outline-none focus:border-primary"
      >
        {options.map((option) => (
          <option key={option.yearMonth} value={option.yearMonth}>
            {option.label} · {formatWonShort(option.amount)}원
            {option.isPaid ? " ✓" : ""}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 size-4 text-muted" />
    </div>
  );
}
