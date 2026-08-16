"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Trash2 } from "lucide-react";
import {
  createTransaction,
  deleteTransaction,
  updateTransaction,
} from "@/app/actions/transaction";
import { CategoryIcon } from "@/components/category-icon";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  CARD_TYPE_LABEL,
  INSTALLMENT_OPTIONS,
  PAYMENT_METHOD_LABEL,
} from "@/lib/labels";
import { cn, formatWon } from "@/lib/utils";
import type {
  PaymentMethod,
  TransactionType,
} from "@/generated/prisma/enums";

type Options = {
  categories: {
    id: string;
    name: string;
    type: TransactionType;
    icon: string | null;
    color: string;
  }[];
  cards: {
    id: string;
    name: string;
    issuer: string | null;
    type: "CREDIT" | "DEBIT" | "PREPAID";
    last4: string | null;
    color: string;
    billingDay: number | null;
    paymentAccountId: string | null;
  }[];
  accounts: {
    id: string;
    name: string;
    bankName: string | null;
    type: string;
    balance: number;
    color: string;
  }[];
  members: {
    id: string;
    displayName: string | null;
    color: string;
    user: { nickname: string; avatarUrl: string | null };
  }[];
};

const TYPE_TABS: { value: TransactionType; label: string }[] = [
  { value: "EXPENSE", label: "지출" },
  { value: "INCOME", label: "수입" },
  { value: "TRANSFER", label: "이체" },
];

/** 지출에서 고를 수 있는 결제수단 */
const EXPENSE_METHODS: PaymentMethod[] = [
  "CARD",
  "CASH",
  "BANK_TRANSFER",
  "AUTO_DEBIT",
  "MOBILE_PAY",
  "POINT",
  "GIFT_CARD",
];

const INCOME_METHODS: PaymentMethod[] = ["BANK_TRANSFER", "CASH", "OTHER"];

/** 수정 화면에서 채워 넣을 기존 값 */
export type EditableTransaction = {
  id: string;
  type: TransactionType;
  amount: number;
  occurredAt: Date;
  merchant: string | null;
  memo: string | null;
  categoryId: string | null;
  paymentMethod: PaymentMethod;
  cardId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  installmentMonths: number;
  isInterestFree: boolean;
  interestAmount: number;
  approvalNo: string | null;
  payerMemberId: string | null;
  isShared: boolean;
  excludeFromStats: boolean;
};

/** 자동 수집함에서 넘어올 때 미리 채울 값 */
export type TransactionInitial = {
  inboxId: string;
  amount: number | null;
  merchant: string | null;
  occurredAt: Date | null;
  cardId: string | null;
  installmentMonths: number;
  rawText: string;
};

export function TransactionForm({
  householdId,
  currentMemberId,
  options,
  defaultType = "EXPENSE",
  transaction,
  initial,
}: {
  householdId: string;
  currentMemberId: string;
  options: Options;
  defaultType?: TransactionType;
  transaction?: EditableTransaction;
  /** 수신함 항목 기반 초기값 (등록 모드에서만) */
  initial?: TransactionInitial;
}) {
  const router = useRouter();

  const isEdit = Boolean(transaction);
  const [state, formAction] = useActionState(
    isEdit ? updateTransaction : createTransaction,
    null,
  );
  const [isDeleting, startDelete] = useTransition();

  const [type, setType] = useState<TransactionType>(
    transaction?.type ?? defaultType,
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(
    transaction?.paymentMethod ??
      (defaultType === "INCOME" ? "BANK_TRANSFER" : "CARD"),
  );
  const [cardId, setCardId] = useState(
    transaction?.cardId ?? initial?.cardId ?? "",
  );
  const [installmentMonths, setInstallmentMonths] = useState(
    transaction?.installmentMonths ?? initial?.installmentMonths ?? 1,
  );
  const [isInterestFree, setIsInterestFree] = useState(
    transaction?.isInterestFree ?? true,
  );
  const [categoryId, setCategoryId] = useState(transaction?.categoryId ?? "");

  const initialAmount = transaction?.amount ?? initial?.amount ?? null;
  const [amountText, setAmountText] = useState(
    initialAmount !== null
      ? new Intl.NumberFormat("ko-KR").format(initialAmount)
      : "",
  );

  const amount = Number(amountText.replace(/[^\d]/g, "")) || 0;

  const categories = useMemo(
    () => options.categories.filter((category) => category.type === type),
    [options.categories, type],
  );

  const selectedCard = options.cards.find((card) => card.id === cardId);

  // 체크카드에 연결된 출금 계좌 (있으면 결제 즉시 여기서 빠진다)
  const linkedAccount = selectedCard?.paymentAccountId
    ? options.accounts.find(
        (account) => account.id === selectedCard.paymentAccountId,
      )
    : undefined;

  // 카드 결제인데 신용카드일 때만 할부를 물어본다 (체크카드는 할부가 없다)
  const canInstallment =
    (paymentMethod === "CARD" || paymentMethod === "MOBILE_PAY") &&
    selectedCard?.type === "CREDIT";

  const methods =
    type === "INCOME"
      ? INCOME_METHODS
      : type === "TRANSFER"
        ? (["BANK_TRANSFER"] as PaymentMethod[])
        : EXPENSE_METHODS;

  function handleTypeChange(nextType: TransactionType) {
    setType(nextType);
    setCategoryId("");

    if (nextType === "INCOME") setPaymentMethod("BANK_TRANSFER");
    else if (nextType === "TRANSFER") setPaymentMethod("BANK_TRANSFER");
    else setPaymentMethod("CARD");
  }

  const needsAccount =
    paymentMethod !== "CARD" &&
    paymentMethod !== "POINT" &&
    paymentMethod !== "GIFT_CARD" &&
    paymentMethod !== "CASH";

  const perRound =
    installmentMonths > 1 ? Math.floor(amount / installmentMonths) : 0;

  return (
    <form action={formAction} className="pb-8">
      <input type="hidden" name="householdId" value={householdId} />
      {transaction && (
        <input type="hidden" name="transactionId" value={transaction.id} />
      )}
      {initial && <input type="hidden" name="inboxId" value={initial.inboxId} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="amount" value={amount} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input
        type="hidden"
        name="installmentMonths"
        value={canInstallment ? installmentMonths : 1}
      />
      <input
        type="hidden"
        name="isInterestFree"
        value={isInterestFree ? "true" : "false"}
      />

      {/* 헤더 */}
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
            {isEdit ? "내역 수정" : "내역 등록"}
          </h1>

          {isEdit ? (
            <button
              type="button"
              aria-label="삭제"
              disabled={isDeleting}
              onClick={() => {
                if (!confirm("이 내역을 삭제할까요? 계좌 잔액도 함께 되돌립니다."))
                  return;
                startDelete(async () => {
                  await deleteTransaction(transaction!.id);
                  router.push("/transactions");
                  router.refresh();
                });
              }}
              className="flex size-9 items-center justify-center rounded-full text-expense active:bg-surface-muted disabled:opacity-50"
            >
              <Trash2 className="size-5" />
            </button>
          ) : (
            <div className="size-9" />
          )}
        </div>
      </header>

      <div className="space-y-5 px-4 py-4">
        {/* 자동 수집 원문 — 파싱이 맞는지 대조용 */}
        {initial && (
          <p className="line-clamp-3 rounded-xl bg-surface-muted px-3 py-2.5 text-[11px] leading-relaxed text-muted">
            {initial.rawText}
          </p>
        )}

        {/* 수입/지출/이체 */}
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-surface-muted p-1">
          {TYPE_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => handleTypeChange(tab.value)}
              className={cn(
                "rounded-lg py-2.5 text-sm font-bold transition",
                type === tab.value
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 금액 */}
        <div className="rounded-2xl border border-border bg-surface p-4">
          <label
            htmlFor="amount-input"
            className="block text-sm font-medium text-muted"
          >
            금액
          </label>
          <div className="mt-1 flex items-baseline gap-1">
            <input
              id="amount-input"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              value={amountText}
              onChange={(event) => {
                const digits = event.target.value.replace(/[^\d]/g, "");
                setAmountText(
                  digits ? new Intl.NumberFormat("ko-KR").format(Number(digits)) : "",
                );
              }}
              className="tabular w-full bg-transparent text-right text-3xl font-bold outline-none placeholder:text-muted/40"
              style={{ fontSize: "2rem" }}
            />
            <span className="text-xl font-bold text-muted">원</span>
          </div>
        </div>

        {/* 날짜 */}
        <Field label="날짜">
          <Input
            type="datetime-local"
            name="occurredAt"
            required
            defaultValue={toLocalInputValue(
              transaction?.occurredAt ?? initial?.occurredAt ?? new Date(),
            )}
          />
        </Field>

        {/* 사용처 */}
        <Field label={type === "INCOME" ? "받은 곳" : "사용처"}>
          <Input
            name="merchant"
            placeholder={type === "INCOME" ? "회사 이름 등" : "가게 이름"}
            maxLength={60}
            defaultValue={transaction?.merchant ?? initial?.merchant ?? ""}
            autoComplete="off"
          />
        </Field>

        {/* 카테고리 */}
        {type !== "TRANSFER" && (
          <div className="space-y-1.5">
            <span className="block text-sm font-medium text-muted">
              카테고리
            </span>
            <div className="flex flex-wrap gap-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() =>
                    setCategoryId(categoryId === category.id ? "" : category.id)
                  }
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border py-1.5 pl-1.5 pr-3 text-sm transition",
                    categoryId === category.id
                      ? "border-primary bg-primary/10 font-medium text-primary"
                      : "border-border bg-surface text-muted",
                  )}
                >
                  <CategoryIcon
                    icon={category.icon}
                    color={category.color}
                    size="sm"
                    className="rounded-full"
                  />
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 결제 수단 */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted">
            {type === "INCOME" ? "받은 방법" : "결제 수단"}
          </span>
          <div className="flex flex-wrap gap-2">
            {methods.map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => setPaymentMethod(method)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition",
                  paymentMethod === method
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border bg-surface text-muted",
                )}
              >
                {PAYMENT_METHOD_LABEL[method]}
              </button>
            ))}
          </div>
        </div>

        {/* 카드 선택 + 할부 */}
        {(paymentMethod === "CARD" || paymentMethod === "MOBILE_PAY") && (
          <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
            <Field label="카드 선택">
              {options.cards.length === 0 ? (
                <p className="rounded-xl bg-surface-muted px-4 py-3 text-sm text-muted">
                  등록된 카드가 없어요. 설정에서 먼저 카드를 등록해 주세요.
                </p>
              ) : (
                <Select
                  name="cardId"
                  value={cardId}
                  onChange={(event) => {
                    setCardId(event.target.value);
                    setInstallmentMonths(1);
                  }}
                  required
                >
                  <option value="">카드를 선택하세요</option>
                  {options.cards.map((card) => (
                    <option key={card.id} value={card.id}>
                      {card.issuer ? `${card.issuer} ` : ""}
                      {card.name}
                      {card.last4 ? ` (${card.last4})` : ""} ·{" "}
                      {CARD_TYPE_LABEL[card.type]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {/*
              체크카드는 긁는 즉시 연결 계좌에서 빠진다.
              어느 통장에서 빠지는지 여기서 확인시켜 준다.
            */}
            {selectedCard?.type === "DEBIT" && (
              <p
                className={cn(
                  "rounded-xl px-3 py-2.5 text-xs leading-relaxed",
                  linkedAccount
                    ? "bg-surface-muted text-muted"
                    : "bg-warning/10 text-warning",
                )}
              >
                {linkedAccount
                  ? `결제하면 ${linkedAccount.bankName ? `${linkedAccount.bankName} ` : ""}${linkedAccount.name} 계좌에서 바로 빠져나갑니다. (현재 잔액 ${formatWon(linkedAccount.balance)})`
                  : "연결 계좌가 없어서 계좌 잔액에는 반영되지 않아요. 카드/자산 화면에서 이 카드에 출금 계좌를 연결해 주세요."}
              </p>
            )}

            {canInstallment && (
              <div className="space-y-2">
                <span className="block text-sm font-medium text-muted">
                  할부 개월
                </span>
                <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {INSTALLMENT_OPTIONS.map((months) => (
                    <button
                      key={months}
                      type="button"
                      onClick={() => setInstallmentMonths(months)}
                      className={cn(
                        "shrink-0 rounded-full border px-4 py-2 text-sm transition",
                        installmentMonths === months
                          ? "border-primary bg-primary/10 font-medium text-primary"
                          : "border-border bg-surface text-muted",
                      )}
                    >
                      {months === 1 ? "일시불" : `${months}개월`}
                    </button>
                  ))}
                </div>

                {installmentMonths > 1 && (
                  <div className="space-y-3 rounded-xl bg-surface-muted p-3">
                    <p className="text-sm">
                      매월{" "}
                      <strong className="tabular">{formatWon(perRound)}</strong>
                      씩 {installmentMonths}번 청구
                      {selectedCard?.billingDay
                        ? ` (매월 ${selectedCard.billingDay}일)`
                        : ""}
                    </p>

                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isInterestFree}
                        onChange={(event) =>
                          setIsInterestFree(event.target.checked)
                        }
                        className="size-4 accent-[var(--primary)]"
                      />
                      무이자 할부
                    </label>

                    {!isInterestFree && (
                      <Field label="할부 수수료 총액 (원)">
                        <Input
                          type="number"
                          name="interestAmount"
                          inputMode="numeric"
                          min={0}
                          defaultValue={0}
                        />
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}

            <Field label="승인번호 (선택)">
              <Input
                name="approvalNo"
                placeholder="카드 문자에 찍힌 번호"
                maxLength={30}
                defaultValue={transaction?.approvalNo ?? ""}
                autoComplete="off"
              />
            </Field>
          </div>
        )}

        {/* 계좌 선택 */}
        {(needsAccount || type === "TRANSFER") && (
          <Field
            label={type === "INCOME" ? "입금 계좌" : "출금 계좌"}
            hint={
              options.accounts.length === 0
                ? "등록된 계좌가 없어요. 설정에서 추가할 수 있어요."
                : undefined
            }
          >
            <Select name="accountId" defaultValue={transaction?.accountId ?? ""}>
              <option value="">선택 안 함</option>
              {options.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bankName ? `${account.bankName} ` : ""}
                  {account.name} ({formatWon(account.balance)})
                </option>
              ))}
            </Select>
          </Field>
        )}

        {type === "TRANSFER" && (
          <Field label="입금 계좌">
            <Select
              name="toAccountId"
              defaultValue={transaction?.toAccountId ?? ""}
              required
            >
              <option value="">선택하세요</option>
              {options.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bankName ? `${account.bankName} ` : ""}
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {/* 결제한 사람 */}
        {options.members.length > 1 && (
          <Field label="결제한 사람">
            <Select
              name="payerMemberId"
              defaultValue={transaction?.payerMemberId ?? currentMemberId}
            >
              {options.members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName ?? member.user.nickname}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {/* 메모 */}
        <Field label="메모 (선택)">
          <Textarea
            name="memo"
            placeholder="남길 말"
            maxLength={200}
            defaultValue={transaction?.memo ?? ""}
          />
        </Field>

        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            name="excludeFromStats"
            defaultChecked={transaction?.excludeFromStats ?? false}
            className="size-4 accent-[var(--primary)]"
          />
          통계에서 제외하기
        </label>

        {state?.error && (
          <p
            className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense"
            role="alert"
          >
            {state.error}
          </p>
        )}

        <SubmitButton size="lg" className="w-full" disabled={amount <= 0}>
          {amount <= 0
            ? "금액을 입력하세요"
            : isEdit
              ? `${formatWon(amount)} 로 저장하기`
              : `${formatWon(amount)} 등록하기`}
        </SubmitButton>
      </div>
    </form>
  );
}

/** datetime-local 입력에 넣을 수 있는 형태로 (로컬 타임존 유지) */
function toLocalInputValue(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
