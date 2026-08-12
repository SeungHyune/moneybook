"use client";

import { useActionState, useState, useTransition } from "react";
import { Check } from "lucide-react";
import {
  cancelCardStatementPayment,
  payCardStatement,
} from "@/app/actions/statement";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/field";
import { formatWon } from "@/lib/utils";

/**
 * 신용카드 대금 납부 처리.
 * 결제일에 통장에서 빠진 걸 기록하면 계좌 잔액이 그만큼 줄어든다.
 */
export function CardStatementActions({
  cardId,
  yearMonth,
  amount,
  accountName,
  hasAccount,
  isPaid,
  paidAmount,
}: {
  cardId: string;
  yearMonth: string;
  amount: number;
  accountName: string | null;
  hasAccount: boolean;
  isPaid: boolean;
  paidAmount: number | null;
}) {
  const [state, formAction] = useActionState(payCardStatement, null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (isPaid) {
    return (
      <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-2.5">
        <span className="flex items-center gap-1.5 text-xs text-success">
          <Check className="size-3.5" />
          {formatWon(paidAmount ?? 0)} 납부 완료
          {accountName && ` · ${accountName}`}
        </span>

        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              await cancelCardStatementPayment(cardId, yearMonth);
            })
          }
          disabled={isPending}
          className="text-xs text-muted underline underline-offset-2 disabled:opacity-50"
        >
          되돌리기
        </button>
      </div>
    );
  }

  if (!hasAccount) {
    return (
      <p className="border-t border-border px-4 py-2.5 text-xs text-warning">
        출금 통장이 연결되지 않았어요. 카드 수정에서 연결하면 결제일에 바로
        처리할 수 있습니다.
      </p>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-2 border-t border-border px-4 py-2.5"
    >
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="yearMonth" value={yearMonth} />

      {isEditing ? (
        <label className="block text-xs text-muted">
          실제 출금액
          <Input
            name="amount"
            type="number"
            inputMode="numeric"
            min={0}
            defaultValue={amount}
            className="mt-1 py-2 text-right"
            required
          />
        </label>
      ) : (
        <input type="hidden" name="amount" value={amount} />
      )}

      {state?.error && (
        <p className="text-xs text-expense" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <SubmitButton size="sm" className="flex-1" pendingText="처리 중...">
          {accountName ? `${accountName}에서 결제` : "결제 완료"}
        </SubmitButton>

        {!isEditing && (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setIsEditing(true)}
          >
            금액 수정
          </Button>
        )}
      </div>
    </form>
  );
}
