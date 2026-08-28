"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Plus, X } from "lucide-react";
import { registerCardOpeningBalance } from "@/app/actions/opening-balance";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatWon } from "@/lib/utils";

/**
 * 카드 등록 직후 "이미 쓴 카드값" 입력.
 * 지난 결제를 하나씩 넣는 대신 갚아야 할 금액만 받아 청구 스케줄을 만든다.
 */

type InstallmentRow = {
  key: number;
  label: string;
  monthly: string;
  remaining: string;
};

export function OpeningBalanceForm({
  cardId,
  cardName,
  billingDayLabel,
}: {
  cardId: string;
  cardName: string;
  /** "9월 25일" 같은 다음 결제일 표기 */
  billingDayLabel: string;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(registerCardOpeningBalance, null);

  const [lumpSumText, setLumpSumText] = useState("");
  const [rows, setRows] = useState<InstallmentRow[]>([]);
  const [nextKey, setNextKey] = useState(1);

  const lumpSum = Number(lumpSumText.replace(/[^\d]/g, "")) || 0;

  const parsedRows = rows.map((row) => ({
    label: row.label.trim(),
    monthly: Number(row.monthly.replace(/[^\d]/g, "")) || 0,
    remaining: Number(row.remaining) || 0,
  }));

  const validRows = parsedRows.filter(
    (row) => row.monthly > 0 && row.remaining > 0,
  );

  // 이번 결제일에 나갈 금액 = 일시불 + 할부들의 이번 달 몫
  const thisMonth =
    lumpSum + validRows.reduce((sum, row) => sum + row.monthly, 0);
  const totalRemaining =
    lumpSum +
    validRows.reduce((sum, row) => sum + row.monthly * row.remaining, 0);

  function addRow() {
    setRows((current) => [
      ...current,
      { key: nextKey, label: "", monthly: "", remaining: "" },
    ]);
    setNextKey((key) => key + 1);
  }

  function updateRow(key: number, patch: Partial<InstallmentRow>) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form action={formAction} className="pb-8">
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="lumpSum" value={lumpSum} />
      <input
        type="hidden"
        name="installments"
        value={JSON.stringify(validRows)}
      />

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
          <h1 className="text-base font-bold">기존 카드값 입력</h1>
          <div className="size-9" />
        </div>
      </header>

      <div className="space-y-5 px-4 py-4">
        <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-muted">
          <strong className="text-foreground">{cardName}</strong>으로 이미 쓴
          금액이 있다면 여기에 넣어주세요. 지난 결제를 하나씩 넣지 않아도
          <strong className="text-foreground"> {billingDayLabel} 결제분</strong>
          부터 청구서에 반영됩니다.
        </p>

        {/* 일시불 */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted">
            이번에 낼 일시불 금액
          </span>
          <div className="flex items-baseline gap-1 rounded-2xl border border-border bg-surface p-4">
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={lumpSumText}
              onChange={(event) => {
                const digits = event.target.value.replace(/[^\d]/g, "");
                setLumpSumText(
                  digits
                    ? new Intl.NumberFormat("ko-KR").format(Number(digits))
                    : "",
                );
              }}
              className="tabular w-full bg-transparent text-right text-2xl font-bold outline-none placeholder:text-muted/40"
            />
            <span className="text-lg font-bold text-muted">원</span>
          </div>
          <p className="text-xs text-muted">
            할부가 아닌, 이번 결제일에 한 번에 빠질 금액이에요.
          </p>
        </div>

        {/* 할부 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted">진행 중인 할부</span>
            <Button type="button" size="sm" variant="secondary" onClick={addRow}>
              <Plus className="size-4" />
              추가
            </Button>
          </div>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted">
              남아 있는 할부가 있으면 추가해 주세요
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((row) => {
                const monthly = Number(row.monthly.replace(/[^\d]/g, "")) || 0;
                const remaining = Number(row.remaining) || 0;

                return (
                  <li
                    key={row.key}
                    className="space-y-2 rounded-2xl border border-border bg-surface p-3"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="어디서 쓴 건가요 (선택)"
                        value={row.label}
                        onChange={(event) =>
                          updateRow(row.key, { label: event.target.value })
                        }
                        maxLength={40}
                        className="py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setRows((current) =>
                            current.filter((item) => item.key !== row.key),
                          )
                        }
                        aria-label="이 할부 지우기"
                        className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted active:bg-surface-muted"
                      >
                        <X className="size-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <Field label="매달 내는 금액">
                        <Input
                          inputMode="numeric"
                          placeholder="0"
                          value={row.monthly}
                          onChange={(event) => {
                            const digits = event.target.value.replace(
                              /[^\d]/g,
                              "",
                            );
                            updateRow(row.key, {
                              monthly: digits
                                ? new Intl.NumberFormat("ko-KR").format(
                                    Number(digits),
                                  )
                                : "",
                            });
                          }}
                          className="py-2 text-right"
                        />
                      </Field>
                      <Field label="남은 횟수">
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={60}
                          placeholder="3"
                          value={row.remaining}
                          onChange={(event) =>
                            updateRow(row.key, { remaining: event.target.value })
                          }
                          className="py-2 text-right"
                        />
                      </Field>
                    </div>

                    {monthly > 0 && remaining > 0 && (
                      <p className="text-[11px] text-muted">
                        {billingDayLabel}부터 매월 {formatWon(monthly)}씩{" "}
                        {remaining}번 · 합계 {formatWon(monthly * remaining)}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* 미리보기 */}
        {thisMonth > 0 && (
          <div className="space-y-1 rounded-2xl bg-primary p-4 text-primary-foreground">
            <p className="text-xs opacity-80">{billingDayLabel} 결제 예정</p>
            <p className="tabular text-2xl font-bold">{formatWon(thisMonth)}</p>
            {totalRemaining > thisMonth && (
              <p className="border-t border-white/20 pt-2 text-xs opacity-80">
                앞으로 낼 총액 {formatWon(totalRemaining)}
              </p>
            )}
          </div>
        )}

        {state?.error && (
          <p
            className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense"
            role="alert"
          >
            {state.error}
          </p>
        )}

        <SubmitButton
          size="lg"
          className="w-full"
          disabled={thisMonth <= 0}
        >
          {thisMonth > 0 ? "카드값 등록하기" : "금액을 입력하세요"}
        </SubmitButton>

        <p className="text-center text-[11px] leading-relaxed text-muted">
          여기서 넣은 금액은 이미 쓴 돈이라 이번 달 지출 통계에는 잡히지 않고,
          <br />
          카드 청구서와 결제 예정 금액에만 반영돼요.
        </p>
      </div>
    </form>
  );
}
