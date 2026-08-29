"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import { deleteSavingsGoal, saveSavingsGoal } from "@/app/actions/budget";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { formatWon } from "@/lib/utils";

/**
 * 저축 목표 등록/수정.
 *
 * 모인 금액은 연결한 계좌 잔액에서 읽는다. 직접 적어 넣게 하면 갱신을
 * 까먹는 순간 숫자가 죽기 때문이다. 계좌를 만들기 전에 이미 모아둔 돈은
 * startAmount 로 한 번만 보정한다.
 */

const won = new Intl.NumberFormat("ko-KR");

function toText(value: number) {
  return value > 0 ? won.format(value) : "";
}

export function SavingsGoalForm({
  goal,
  accounts,
}: {
  goal?: {
    id: string;
    name: string;
    targetAmount: number;
    targetDate: Date | null;
    accountId: string | null;
    startAmount: number;
  };
  accounts: {
    id: string;
    name: string;
    bankName: string | null;
    type: string;
    balance: number;
  }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveSavingsGoal, null);
  const [isPending, startTransition] = useTransition();

  const [targetText, setTargetText] = useState(
    toText(goal?.targetAmount ?? 0),
  );
  const [startText, setStartText] = useState(toText(goal?.startAmount ?? 0));
  const [accountId, setAccountId] = useState(goal?.accountId ?? "");

  const target = Number(targetText.replace(/[^\d]/g, "")) || 0;
  const start = Number(startText.replace(/[^\d]/g, "")) || 0;
  const account = accounts.find((item) => item.id === accountId);
  const saved = start + (account?.balance ?? 0);

  return (
    <form action={formAction} className="pb-8">
      {goal && <input type="hidden" name="id" value={goal.id} />}
      <input type="hidden" name="targetAmount" value={target} />
      <input type="hidden" name="startAmount" value={start} />

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
            {goal ? "저축 목표 수정" : "저축 목표"}
          </h1>

          {goal ? (
            <button
              type="button"
              onClick={() =>
                startTransition(async () => {
                  await deleteSavingsGoal(goal.id);
                  router.push("/budget");
                })
              }
              disabled={isPending}
              aria-label="삭제"
              className="flex size-9 items-center justify-center rounded-full text-expense active:bg-surface-muted disabled:opacity-50"
            >
              <Trash2 className="size-4" />
            </button>
          ) : (
            <div className="size-9" />
          )}
        </div>
      </header>

      <div className="space-y-5 px-4 py-4">
        <Field label="목표 이름">
          <Input
            name="name"
            placeholder="전세 자금"
            defaultValue={goal?.name}
            maxLength={40}
            required
          />
        </Field>

        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted">
            모을 금액
          </span>
          <div className="flex items-baseline gap-1 rounded-2xl border border-border bg-surface p-4">
            <input
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={targetText}
              onChange={(event) => {
                const digits = event.target.value.replace(/[^\d]/g, "");
                setTargetText(digits ? won.format(Number(digits)) : "");
              }}
              className="tabular w-full bg-transparent text-right text-2xl font-bold outline-none placeholder:text-muted/40"
            />
            <span className="text-lg font-bold text-muted">원</span>
          </div>
        </div>

        <Field label="언제까지 (선택)">
          <Input
            name="targetDate"
            type="date"
            defaultValue={
              goal?.targetDate
                ? goal.targetDate.toISOString().slice(0, 10)
                : undefined
            }
          />
        </Field>

        <Field label="모으는 통장">
          <Select
            name="accountId"
            value={accountId}
            onChange={(event) => setAccountId(event.target.value)}
          >
            <option value="">연결 안 함</option>
            {accounts.map((item) => (
              <option key={item.id} value={item.id}>
                {item.bankName ? `${item.bankName} ` : ""}
                {item.name} · {formatWon(item.balance)}
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {account
              ? "이 통장 잔액이 모인 금액으로 잡혀요. 통장이 늘면 목표도 같이 올라갑니다."
              : "통장을 연결하면 잔액이 곧 모인 금액이 돼요. 연결하지 않으면 아래 금액만 표시됩니다."}
          </p>
        </Field>

        <Field label="이미 모아둔 금액 (선택)">
          <Input
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            value={startText}
            onChange={(event) => {
              const digits = event.target.value.replace(/[^\d]/g, "");
              setStartText(digits ? won.format(Number(digits)) : "");
            }}
            className="text-right"
          />
          <p className="mt-1 text-xs text-muted">
            통장을 만들기 전에 다른 곳에 모아둔 돈이 있으면 여기에 더해요.
          </p>
        </Field>

        {target > 0 && (
          <div className="space-y-1 rounded-2xl bg-primary p-4 text-primary-foreground">
            <p className="text-xs opacity-80">지금까지 모은 돈</p>
            <p className="tabular text-2xl font-bold">{formatWon(saved)}</p>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/25">
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: `${Math.min(100, Math.max((saved / target) * 100, 1))}%`,
                }}
              />
            </div>
            <p className="pt-1 text-xs opacity-80">
              목표까지 {formatWon(Math.max(0, target - saved))} 남음
            </p>
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

        <SubmitButton size="lg" className="w-full" disabled={target <= 0}>
          {goal ? "목표 수정하기" : "목표 만들기"}
        </SubmitButton>
      </div>
    </form>
  );
}
