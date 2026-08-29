"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { saveBudgets } from "@/app/actions/budget";
import { CategoryIcon } from "@/components/category-icon";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatWon } from "@/lib/utils";

/**
 * 예산 수정.
 *
 * 월 전체 한도와 카테고리별 한도를 한 화면에서 정한다.
 * 카테고리 합이 월 한도를 넘거나 남으면 바로 알려준다 — 다 정하고 나서
 * "왜 숫자가 안 맞지" 하고 되돌아오는 일이 없도록.
 */

type Row = {
  categoryId: string | null;
  name: string;
  icon: string;
  color: string;
  /** 화면에 보이는 문자열 (천 단위 콤마 포함) */
  text: string;
  /** 참고용 — 이번 달 이미 쓴 금액 */
  spent: number;
};

const won = new Intl.NumberFormat("ko-KR");

function toNumber(text: string) {
  return Number(text.replace(/[^\d]/g, "")) || 0;
}

function toText(value: number) {
  return value > 0 ? won.format(value) : "";
}

export function BudgetForm({
  yearMonth,
  monthlyLimit,
  categories,
}: {
  yearMonth: string;
  monthlyLimit: number | null;
  categories: {
    categoryId: string;
    name: string;
    icon: string;
    color: string;
    limit: number | null;
    spent: number;
  }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveBudgets, null);

  const [monthText, setMonthText] = useState(toText(monthlyLimit ?? 0));
  const [rows, setRows] = useState<Row[]>(() =>
    categories.map((category) => ({
      categoryId: category.categoryId,
      name: category.name,
      icon: category.icon,
      color: category.color,
      text: toText(category.limit ?? 0),
      spent: category.spent,
    })),
  );

  const monthLimit = toNumber(monthText);
  const assigned = rows.reduce((sum, row) => sum + toNumber(row.text), 0);
  const rest = monthLimit - assigned;

  const entries = [
    { categoryId: null, amount: monthLimit },
    ...rows.map((row) => ({
      categoryId: row.categoryId,
      amount: toNumber(row.text),
    })),
  ];

  return (
    <form action={formAction} className="pb-8">
      <input type="hidden" name="yearMonth" value={yearMonth} />
      <input type="hidden" name="entries" value={JSON.stringify(entries)} />

      <header
        className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="flex h-14 items-center justify-between px-2">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로"
            className="flex size-9 items-center justify-center rounded-full text-muted active:bg-surface-muted"
          >
            <ChevronLeft className="size-5" />
          </button>
          <h1 className="text-base font-bold">
            {Number(yearMonth.split("-")[1])}월 예산
          </h1>
          <div className="size-9" />
        </div>
      </header>

      <div className="space-y-5 px-4 py-4">
        {/* 월 전체 */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted">
            한 달에 쓸 돈
          </span>
          <div className="flex items-baseline gap-1 rounded-2xl border border-border bg-surface p-4">
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={monthText}
              onChange={(event) =>
                setMonthText(toText(toNumber(event.target.value)))
              }
              className="tabular w-full bg-transparent text-right text-2xl font-bold outline-none placeholder:text-muted/40"
            />
            <span className="text-lg font-bold text-muted">원</span>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            고정지출(관리비·통신비 등)도 이 안에 포함해서 정해 주세요. 홈의
            &ldquo;더 쓸 수 있는 돈&rdquo;이 이 금액을 기준으로 계산됩니다.
          </p>
        </div>

        {/* 배정 현황 */}
        {monthLimit > 0 && (
          <div
            className={`rounded-2xl px-4 py-3 text-sm ${
              rest < 0
                ? "bg-expense/10 text-expense"
                : "bg-surface-muted text-muted"
            }`}
          >
            {rest < 0 ? (
              <>
                카테고리 합계가 월 예산보다{" "}
                <strong>{formatWon(-rest)}</strong> 많아요.
              </>
            ) : (
              <>
                카테고리에 {formatWon(assigned)} 배정 · 남은{" "}
                <strong className="text-foreground">{formatWon(rest)}</strong>
              </>
            )}
          </div>
        )}

        {/* 카테고리별 */}
        <div className="space-y-2">
          <span className="block text-sm font-medium text-muted">
            카테고리별 한도 (선택)
          </span>

          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
            {rows.map((row, index) => (
              <li
                key={row.categoryId}
                className="flex items-center gap-3 py-3"
              >
                <CategoryIcon icon={row.icon} color={row.color} size="sm" />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row.name}</p>
                  {row.spent > 0 && (
                    <p className="text-[11px] text-muted">
                      이번 달 {formatWon(row.spent)} 씀
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-baseline gap-1">
                  <input
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="0"
                    value={row.text}
                    onChange={(event) => {
                      const text = toText(toNumber(event.target.value));
                      setRows((current) =>
                        current.map((item, itemIndex) =>
                          itemIndex === index ? { ...item, text } : item,
                        ),
                      );
                    }}
                    className="tabular w-24 rounded-lg bg-surface-muted px-2 py-1.5 text-right text-sm outline-none placeholder:text-muted/40"
                  />
                  <span className="text-xs text-muted">원</span>
                </div>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted">
            비워두면 한도 없이 금액만 보여줍니다. 0 으로 두면 한도가 지워져요.
          </p>
        </div>

        {state?.error && (
          <p
            className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense"
            role="alert"
          >
            {state.error}
          </p>
        )}

        <SubmitButton size="lg" className="w-full">
          예산 저장하기
        </SubmitButton>
      </div>
    </form>
  );
}
