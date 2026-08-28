"use client";

import { useActionState, useState } from "react";
import { updateCardPaymentAccount } from "@/app/actions/card-account";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ownerPrefix } from "@/lib/labels";
import { cn } from "@/lib/utils";

/**
 * 신용카드 출금 통장 변경.
 *
 * 통장만 바꾸면 이미 처리한 카드대금은 옛 통장에 남아 잔액이 어긋난다.
 * 그렇다고 늘 과거까지 옮기는 것도 틀리다 — "이번 달부터 통장을 바꿨다"면
 * 지난 건은 그대로여야 하니까. 그래서 언제부터 이 통장이었는지를 받는다.
 */

type AccountOption = {
  id: string;
  name: string;
  bankName: string | null;
  ownerMember?: { displayName: string | null } | null;
};

const APPLY_OPTIONS = [
  {
    value: "none",
    label: "이번부터",
    description: "다음 납부부터 새 통장에서 빠져요. 지난 기록은 그대로 둡니다.",
  },
  {
    value: "date",
    label: "특정 날짜부터",
    description: "그날 이후 납부한 카드대금을 새 통장으로 옮기고 잔액도 맞춰요.",
  },
  {
    value: "all",
    label: "처음부터 계속",
    description: "이 카드로 낸 모든 카드대금을 새 통장으로 옮깁니다.",
  },
] as const;

export function PaymentAccountChanger({
  cardId,
  currentAccountId,
  accounts,
}: {
  cardId: string;
  currentAccountId: string | null;
  accounts: AccountOption[];
}) {
  const [state, formAction] = useActionState(updateCardPaymentAccount, null);

  const [accountId, setAccountId] = useState(currentAccountId ?? "");
  const [applyMode, setApplyMode] =
    useState<(typeof APPLY_OPTIONS)[number]["value"]>("none");
  const [sinceDate, setSinceDate] = useState("");

  const isChanged = accountId !== (currentAccountId ?? "");

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-2xl border border-border bg-surface p-4"
    >
      <input type="hidden" name="cardId" value={cardId} />
      <input
        type="hidden"
        name="applyFrom"
        value={
          applyMode === "date" ? sinceDate || "none" : applyMode
        }
      />

      <div>
        <h2 className="text-sm font-bold">출금 통장</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          결제일에 카드대금이 빠져나가는 통장이에요.
        </p>
      </div>

      <Field label="통장">
        <Select
          name="accountId"
          value={accountId}
          onChange={(event) => setAccountId(event.target.value)}
        >
          <option value="">연결 안 함</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {ownerPrefix(account.ownerMember)}
              {account.bankName ? `${account.bankName} ` : ""}
              {account.name}
            </option>
          ))}
        </Select>
      </Field>

      {/* 통장을 실제로 바꿀 때만 소급 여부를 묻는다 */}
      {isChanged && accountId && (
        <div className="space-y-2 rounded-xl bg-surface-muted p-3">
          <p className="text-xs font-medium">
            언제부터 이 통장에서 빠져나갔나요?
          </p>

          <div className="space-y-1.5">
            {APPLY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 transition",
                  applyMode === option.value
                    ? "border-primary bg-primary/5"
                    : "border-transparent",
                )}
              >
                <input
                  type="radio"
                  name="applyMode"
                  value={option.value}
                  checked={applyMode === option.value}
                  onChange={() => setApplyMode(option.value)}
                  className="mt-0.5 size-4 accent-[var(--primary)]"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-medium">
                    {option.label}
                  </span>
                  <span className="block text-[11px] leading-relaxed text-muted">
                    {option.description}
                  </span>
                </span>
              </label>
            ))}
          </div>

          {applyMode === "date" && (
            <Field label="이 날짜 이후 납부분부터">
              <Input
                type="date"
                value={sinceDate}
                onChange={(event) => setSinceDate(event.target.value)}
                className="py-2"
                required
              />
            </Field>
          )}

          {applyMode !== "none" && (
            <p className="text-[11px] leading-relaxed text-warning">
              옮기는 만큼 옛 통장 잔액은 되돌리고 새 통장에서 빠집니다.
            </p>
          )}
        </div>
      )}

      {state?.error && (
        <p className="text-sm text-expense" role="alert">
          {state.error}
        </p>
      )}
      {state?.success && (
        <p className="text-sm text-success" role="status">
          {state.success}
        </p>
      )}

      <SubmitButton
        size="md"
        variant="secondary"
        className="w-full"
        disabled={!isChanged}
      >
        {isChanged ? "출금 통장 변경" : "변경 사항 없음"}
      </SubmitButton>
    </form>
  );
}
