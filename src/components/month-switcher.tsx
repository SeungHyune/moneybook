"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, formatYearMonth, toYearMonth } from "@/lib/utils";

export function MonthSwitcher({ yearMonth }: { yearMonth: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const isCurrentMonth = yearMonth === toYearMonth(new Date());

  function move(delta: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("month", addMonths(yearMonth, delta));
    router.push(`?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <button
        type="button"
        onClick={() => move(-1)}
        aria-label="이전 달"
        className="flex size-9 items-center justify-center rounded-full text-muted transition active:bg-surface-muted"
      >
        <ChevronLeft className="size-5" />
      </button>

      <span className="min-w-28 text-center text-base font-bold">
        {formatYearMonth(yearMonth)}
      </span>

      <button
        type="button"
        onClick={() => move(1)}
        aria-label="다음 달"
        disabled={isCurrentMonth}
        className="flex size-9 items-center justify-center rounded-full text-muted transition active:bg-surface-muted disabled:opacity-30"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
