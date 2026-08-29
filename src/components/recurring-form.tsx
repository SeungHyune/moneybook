"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createRecurringRule } from "@/app/actions/recurring";
import { CategoryIcon } from "@/components/category-icon";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  FREQUENCY_LABEL,
  PAYMENT_METHOD_LABEL,
  RECURRING_KIND_META,
  ownerPrefix,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type {
  Frequency,
  PaymentMethod,
  RecurringKind,
} from "@/generated/prisma/enums";

type Owner = { displayName: string | null } | null;

type Options = {
  categories: { id: string; name: string; type: string; icon: string | null }[];
  cards: {
    id: string;
    name: string;
    issuer: string | null;
    last4: string | null;
    ownerMember?: Owner;
  }[];
  accounts: {
    id: string;
    name: string;
    bankName: string | null;
    ownerMember?: Owner;
  }[];
};

const KIND_ORDER: RecurringKind[] = [
  "SALARY",
  "CARD_BILL",
  "MAINTENANCE_FEE",
  "TELECOM",
  "UTILITY",
  "RENT",
  "INSURANCE",
  "SUBSCRIPTION",
  "LOAN_REPAYMENT",
  "SAVINGS",
  "EDUCATION",
  "MEMBERSHIP",
  "SIDE_INCOME",
  "OTHER",
];

const PAYMENT_METHODS: PaymentMethod[] = [
  "AUTO_DEBIT",
  "CARD",
  "BANK_TRANSFER",
  "CASH",
];

const FREQUENCIES: Frequency[] = [
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "YEARLY",
];

export function RecurringForm({
  householdId,
  options,
}: {
  householdId: string;
  options: Options;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(createRecurringRule, null);

  const [kind, setKind] = useState<RecurringKind>("MAINTENANCE_FEE");
  const [frequency, setFrequency] = useState<Frequency>("MONTHLY");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("AUTO_DEBIT");
  const [isAmountVariable, setIsAmountVariable] = useState(false);

  const meta = RECURRING_KIND_META[kind];

  /*
   * 적금 납입이나 대출 상환은 돈이 없어지는 게 아니라 내 계좌 사이를
   * 옮기는 것이다. 지출로 넣으면 "이번 달 쓴 돈" 이 실제보다 커진다.
   * 그래서 지출 성격 항목에 한해 "이체로 등록" 을 고를 수 있게 뒀다.
   */
  const [asTransfer, setAsTransfer] = useState(false);
  const canBeTransfer = meta.type === "EXPENSE" && options.accounts.length >= 2;
  const isTransfer = canBeTransfer && asTransfer;
  const type = isTransfer ? "TRANSFER" : meta.type;

  const categories = options.categories.filter(
    (category) => category.type === type,
  );

  return (
    <form action={formAction} className="pb-8">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="frequency" value={frequency} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <input
        type="hidden"
        name="isAmountVariable"
        value={isAmountVariable ? "true" : "false"}
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
          <h1 className="text-base font-bold">고정지출 등록</h1>
          <div className="size-9" />
        </div>
      </header>

      <div className="space-y-5 px-4 py-4">
        {/* 종류 */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted">종류</span>
          <div className="grid grid-cols-3 gap-2">
            {KIND_ORDER.map((option) => {
              const optionMeta = RECURRING_KIND_META[option];
              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => setKind(option)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs transition",
                    kind === option
                      ? "border-primary bg-primary/10 font-bold text-primary"
                      : "border-border bg-surface text-muted",
                  )}
                >
                  <CategoryIcon
                    icon={optionMeta.emoji}
                    color={optionMeta.color}
                    size="sm"
                  />
                  {optionMeta.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            {type === "INCOME"
              ? "수입 항목으로 등록됩니다"
              : isTransfer
                ? "계좌 간 이동으로 등록됩니다 — 지출 합계에 잡히지 않아요"
                : "지출 항목으로 등록됩니다"}
          </p>

          {canBeTransfer && (
            <label className="flex items-start gap-2.5 rounded-xl bg-surface-muted px-3 py-2.5">
              <input
                type="checkbox"
                checked={asTransfer}
                onChange={(event) => setAsTransfer(event.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-[var(--color-primary)]"
              />
              <span className="text-xs leading-relaxed">
                <strong className="font-medium">내 계좌로 옮기는 거예요</strong>
                <br />
                <span className="text-muted">
                  적금 납입이나 파킹통장 이체처럼 돈이 없어지는 게 아니라
                  자리만 바뀌는 경우예요. 지출로 세지 않습니다.
                </span>
              </span>
            </label>
          )}
        </div>

        <Field label="이름">
          <Input
            name="name"
            required
            maxLength={40}
            placeholder={`예: ${meta.label}`}
            defaultValue={meta.label}
            autoComplete="off"
          />
        </Field>

        <Field
          label={isAmountVariable ? "예상 금액 (원)" : "금액 (원)"}
          hint={
            isAmountVariable
              ? "매달 실제 금액을 입력해서 확정할 수 있어요."
              : undefined
          }
        >
          <Input
            name="amount"
            type="number"
            inputMode="numeric"
            min={0}
            required
            placeholder="0"
            className="text-right"
          />
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isAmountVariable}
            onChange={(event) => setIsAmountVariable(event.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          매달 금액이 달라져요 (관리비, 전기요금 등)
        </label>

        {/* 주기 */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted">주기</span>
          <div className="flex flex-wrap gap-2">
            {FREQUENCIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setFrequency(option)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm transition",
                  frequency === option
                    ? "border-primary bg-primary/10 font-medium text-primary"
                    : "border-border bg-surface text-muted",
                )}
              >
                {FREQUENCY_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="날짜 (매월 며칠)">
            <Input
              name="dayOfMonth"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              defaultValue={25}
              required
            />
          </Field>

          {frequency === "YEARLY" && (
            <Field label="월">
              <Input
                name="monthOfYear"
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                defaultValue={1}
              />
            </Field>
          )}

          <Field label="주말이면">
            <Select name="dueDateShift" defaultValue="NONE">
              <option value="NONE">그대로</option>
              <option value="PREV_BUSINESS_DAY">앞당김 (급여일)</option>
              <option value="NEXT_BUSINESS_DAY">미룸</option>
            </Select>
          </Field>
        </div>

        {/* 결제 수단 */}
        <div className="space-y-1.5">
          <span className="block text-sm font-medium text-muted">
            {type === "INCOME" ? "입금 방법" : "결제 방법"}
          </span>
          <div className="flex flex-wrap gap-2">
            {PAYMENT_METHODS.map((method) => (
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

        {paymentMethod === "CARD" ? (
          <Field label="카드">
            <Select name="cardId" defaultValue="">
              <option value="">선택 안 함</option>
              {options.cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {ownerPrefix(card.ownerMember)}
                  {card.issuer ? `${card.issuer} ` : ""}
                  {card.name}
                  {card.last4 ? ` (${card.last4})` : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field
            label={
              type === "INCOME"
                ? "입금 계좌"
                : isTransfer
                  ? "보내는 계좌"
                  : "출금 계좌"
            }
          >
            <Select name="accountId" defaultValue="" required={isTransfer}>
              <option value="">선택 안 함</option>
              {options.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {ownerPrefix(account.ownerMember)}
                  {account.bankName ? `${account.bankName} ` : ""}
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        )}

        {isTransfer && (
          <Field label="받는 계좌">
            <Select name="toAccountId" defaultValue="" required>
              <option value="">선택하세요</option>
              {options.accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {ownerPrefix(account.ownerMember)}
                  {account.bankName ? `${account.bankName} ` : ""}
                  {account.name}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">
              적금 통장이 목록에 없으면 카드/자산에서 먼저 등록해 주세요.
            </p>
          </Field>
        )}

        {!isTransfer && (
        <Field label="카테고리">
          <Select name="categoryId" defaultValue="">
            <option value="">선택 안 함</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.icon} {category.name}
              </option>
            ))}
          </Select>
        </Field>
        )}

        <Field label="알림" hint="납부일 전에 알려드려요.">
          <Select name="notifyDaysBefore" defaultValue="1">
            <option value="0">당일</option>
            <option value="1">1일 전</option>
            <option value="3">3일 전</option>
            <option value="7">7일 전</option>
          </Select>
        </Field>

        <Field label="메모 (선택)">
          <Textarea name="memo" maxLength={200} placeholder="남길 말" />
        </Field>

        {state?.error && (
          <p
            className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense"
            role="alert"
          >
            {state.error}
          </p>
        )}

        <SubmitButton size="lg" className="w-full">
          등록하기
        </SubmitButton>
      </div>
    </form>
  );
}
