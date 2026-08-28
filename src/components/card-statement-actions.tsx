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
 *
 * 되돌리기는 "실수로 눌렀을 때" 되돌리는 용도라 납부 후 30일까지만 열어 둔다.
 * (그보다 오래된 건 다음 달 청구서가 이미 돌아간 시점이라, 되돌리면
 *  잔액이 꼬이기 쉽다. 그때는 내역에서 직접 고치는 편이 안전하다.)
 */
const UNDO_WINDOW_DAYS = 30;

function toDateInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function CardStatementActions({
  cardId,
  yearMonth,
  amount,
  accountName,
  hasAccount,
  isPaid,
  paidAmount,
  canUndo = true,
  isOverdue = false,
}: {
  cardId: string;
  yearMonth: string;
  amount: number;
  accountName: string | null;
  hasAccount: boolean;
  isPaid: boolean;
  paidAmount: number | null;
  /** 되돌리기 가능 여부 — 서버에서 납부일 기준으로 판단해 넘긴다 */
  canUndo?: boolean;
  /** 예정 결제일이 지났는지 — 실제 납부일 입력을 띄울지 결정 */
  isOverdue?: boolean;
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

        {canUndo ? (
          <button
            type="button"
            onClick={() =>
              startTransition(async () => {
                await cancelCardStatementPayment(cardId, yearMonth);
              })
            }
            disabled={isPending}
            className="shrink-0 text-xs text-muted underline underline-offset-2 disabled:opacity-50"
          >
            되돌리기
          </button>
        ) : (
          <span className="shrink-0 text-[11px] text-muted">
            {UNDO_WINDOW_DAYS}일 지나 되돌릴 수 없어요
          </span>
        )}
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

  // 결제일이 지났으면(isOverdue) 실제로 언제 냈는지 받는 게 자연스럽다
  const defaultPaidAt = toDateInput(new Date());

  return (
    <form
      action={formAction}
      className="space-y-2 border-t border-border px-4 py-2.5"
    >
      <input type="hidden" name="cardId" value={cardId} />
      <input type="hidden" name="yearMonth" value={yearMonth} />

      {isEditing ? (
        <div className="grid grid-cols-2 gap-2">
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
          <label className="block text-xs text-muted">
            납부일
            <Input
              name="paidAt"
              type="date"
              defaultValue={defaultPaidAt}
              className="mt-1 py-2"
            />
          </label>
        </div>
      ) : (
        <>
          <input type="hidden" name="amount" value={amount} />
          {/* 연체 건은 실제 납부일을 받아야 기록이 정확해진다 */}
          {isOverdue && (
            <label className="block text-xs text-muted">
              실제 납부일
              <Input
                name="paidAt"
                type="date"
                defaultValue={defaultPaidAt}
                className="mt-1 py-2"
              />
            </label>
          )}
        </>
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
