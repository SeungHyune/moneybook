"use client";

import { useActionState, useState, useTransition } from "react";
import { markOccurrencePaid, skipOccurrence } from "@/app/actions/recurring";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Input } from "@/components/ui/field";
import { formatWon } from "@/lib/utils";

/**
 * 고정지출 한 건에 대한 "납부 완료 / 건너뛰기".
 * 관리비처럼 금액이 매달 다른 항목은 실제 금액을 입력받는다.
 */
export function FixedItemActions({
  ruleId,
  yearMonth,
  defaultAmount,
  isAmountVariable,
}: {
  ruleId: string;
  yearMonth: string;
  defaultAmount: number;
  isAmountVariable: boolean;
}) {
  const [state, formAction] = useActionState(markOccurrencePaid, null);
  const [isEditing, setIsEditing] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSkip() {
    startTransition(async () => {
      await skipOccurrence(ruleId, yearMonth);
    });
  }

  // 금액이 고정인 항목은 바로 완료 처리
  if (!isAmountVariable && !isEditing) {
    return (
      <div className="mt-3 flex gap-2 border-t border-border pt-3">
        <form action={formAction} className="flex-1">
          <input type="hidden" name="ruleId" value={ruleId} />
          <input type="hidden" name="yearMonth" value={yearMonth} />
          <input type="hidden" name="actualAmount" value={defaultAmount} />
          <SubmitButton
            size="sm"
            className="w-full"
            pendingText="처리 중..."
          >
            완료 처리
          </SubmitButton>
        </form>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setIsEditing(true)}
        >
          금액 수정
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleSkip}
          disabled={isPending}
        >
          건너뛰기
        </Button>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-3 space-y-2 border-t border-border pt-3"
    >
      <input type="hidden" name="ruleId" value={ruleId} />
      <input type="hidden" name="yearMonth" value={yearMonth} />

      <label className="block text-xs text-muted">
        실제 납부 금액
        <Input
          name="actualAmount"
          type="number"
          inputMode="numeric"
          min={0}
          defaultValue={defaultAmount}
          className="mt-1 py-2 text-right"
          required
        />
      </label>

      <p className="text-[11px] text-muted">
        예상 금액 {formatWon(defaultAmount)}
      </p>

      {state?.error && (
        <p className="text-xs text-expense" role="alert">
          {state.error}
        </p>
      )}

      <div className="flex gap-2">
        <SubmitButton size="sm" className="flex-1" pendingText="처리 중...">
          완료 처리
        </SubmitButton>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={handleSkip}
          disabled={isPending}
        >
          건너뛰기
        </Button>
      </div>
    </form>
  );
}
