"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { createAccount, createCard } from "@/app/actions/asset";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ACCOUNT_TYPE_LABEL, BANKS, CARD_ISSUERS } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Member = {
  id: string;
  displayName: string | null;
  user: { nickname: string };
};

const CARD_COLORS = [
  "#8b5cf6",
  "#3b5bfd",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#64748b",
];

export function AssetForm({
  householdId,
  members,
  accounts,
  defaultTab = "card",
}: {
  householdId: string;
  members: Member[];
  accounts: { id: string; name: string; bankName: string | null }[];
  defaultTab?: "card" | "account";
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"card" | "account">(defaultTab);

  return (
    <div className="pb-8">
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
          <h1 className="text-base font-bold">카드 / 계좌 등록</h1>
          <div className="size-9" />
        </div>
      </header>

      <div className="px-4 py-4">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
          {(["card", "account"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "rounded-lg py-2.5 text-sm font-bold transition",
                tab === value
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted",
              )}
            >
              {value === "card" ? "카드" : "계좌"}
            </button>
          ))}
        </div>

        {tab === "card" ? (
          <CardForm
            householdId={householdId}
            members={members}
            accounts={accounts}
          />
        ) : (
          <AccountForm householdId={householdId} members={members} />
        )}
      </div>
    </div>
  );
}

function CardForm({
  householdId,
  members,
  accounts,
}: {
  householdId: string;
  members: Member[];
  accounts: { id: string; name: string; bankName: string | null }[];
}) {
  const [state, formAction] = useActionState(createCard, null);
  const [type, setType] = useState<"CREDIT" | "DEBIT" | "PREPAID">("CREDIT");
  const [color, setColor] = useState(CARD_COLORS[0]);

  return (
    <form action={formAction} className="mt-5 space-y-5">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="color" value={color} />

      <div className="space-y-1.5">
        <span className="block text-sm font-medium text-muted">카드 종류</span>
        <div className="flex gap-2">
          {(["CREDIT", "DEBIT", "PREPAID"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              className={cn(
                "flex-1 rounded-xl border py-2.5 text-sm transition",
                type === option
                  ? "border-primary bg-primary/10 font-bold text-primary"
                  : "border-border bg-surface text-muted",
              )}
            >
              {option === "CREDIT"
                ? "신용"
                : option === "DEBIT"
                  ? "체크"
                  : "선불"}
            </button>
          ))}
        </div>
      </div>

      <Field label="카드사">
        <Select name="issuer" defaultValue="">
          <option value="">선택 안 함</option>
          {CARD_ISSUERS.map((issuer) => (
            <option key={issuer} value={issuer}>
              {issuer}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="카드 이름" hint="예: Deep Dream, 더모아">
        <Input
          name="name"
          required
          maxLength={30}
          placeholder="카드 이름"
          autoComplete="off"
        />
      </Field>

      <Field label="카드 끝 4자리 (선택)">
        <Input
          name="last4"
          inputMode="numeric"
          maxLength={4}
          placeholder="1234"
          pattern="\d{0,4}"
          autoComplete="off"
        />
      </Field>

      {type === "CREDIT" && (
        <div className="space-y-4 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-bold">결제 정보</p>

          <Field label="결제일 (매월 며칠)" hint="카드값이 통장에서 빠지는 날">
            <Input
              name="billingDay"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              defaultValue={25}
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="이용기간 시작">
              <Input
                name="statementStartDay"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                defaultValue={12}
              />
            </Field>
            <Field label="이용기간 종료">
              <Input
                name="statementEndDay"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                defaultValue={11}
              />
            </Field>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            보통 &ldquo;전월 12일 ~ 당월 11일 사용분을 25일에 결제&rdquo;처럼
            정해져 있어요. 카드사 앱에서 확인할 수 있습니다.
          </p>

          <Field label="결제 계좌 (선택)">
            <Select name="paymentAccountId" defaultValue="">
              <option value="">선택 안 함</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bankName ? `${account.bankName} ` : ""}
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      )}

      {members.length > 1 && (
        <Field label="누구 카드인가요?">
          <Select name="ownerMemberId" defaultValue="">
            <option value="">공용</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName ?? member.user.nickname}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <ColorPicker value={color} onChange={setColor} />

      {state?.error && (
        <p
          className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <SubmitButton size="lg" className="w-full">
        카드 등록하기
      </SubmitButton>
    </form>
  );
}

function AccountForm({
  householdId,
  members,
}: {
  householdId: string;
  members: Member[];
}) {
  const [state, formAction] = useActionState(createAccount, null);
  const [color, setColor] = useState("#0ea5e9");

  return (
    <form action={formAction} className="mt-5 space-y-5">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="color" value={color} />

      <Field label="계좌 종류">
        <Select name="type" defaultValue="CHECKING">
          {Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="은행">
        <Select name="bankName" defaultValue="">
          <option value="">선택 안 함</option>
          {BANKS.map((bank) => (
            <option key={bank} value={bank}>
              {bank}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="계좌 이름" hint="예: 생활비 통장, 비상금">
        <Input
          name="name"
          required
          maxLength={30}
          placeholder="계좌 이름"
          autoComplete="off"
        />
      </Field>

      <Field label="계좌 끝 4자리 (선택)">
        <Input
          name="last4"
          inputMode="numeric"
          maxLength={4}
          placeholder="1234"
          pattern="\d{0,4}"
          autoComplete="off"
        />
      </Field>

      <Field label="현재 잔액 (원)">
        <Input
          name="balance"
          type="number"
          inputMode="numeric"
          defaultValue={0}
          className="text-right"
        />
      </Field>

      {members.length > 1 && (
        <Field label="누구 계좌인가요?">
          <Select name="ownerMemberId" defaultValue="">
            <option value="">공용</option>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName ?? member.user.nickname}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <ColorPicker value={color} onChange={setColor} />

      {state?.error && (
        <p
          className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <SubmitButton size="lg" className="w-full">
        계좌 등록하기
      </SubmitButton>
    </form>
  );
}

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="block text-sm font-medium text-muted">색상</span>
      <div className="flex flex-wrap gap-2">
        {CARD_COLORS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-label={`색상 ${option}`}
            aria-pressed={value === option}
            className={cn(
              "size-9 rounded-full transition",
              value === option && "ring-2 ring-foreground ring-offset-2 ring-offset-[var(--background)]",
            )}
            style={{ backgroundColor: option }}
          />
        ))}
      </div>
    </div>
  );
}
