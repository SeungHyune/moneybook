"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  createAccount,
  createCard,
  updateAccount,
  updateCard,
} from "@/app/actions/asset";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ACCOUNT_TYPE_LABEL, BANKS, CARD_ISSUERS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { AccountType, CardType, MemberRole } from "@/generated/prisma/enums";

export type AssetMember = {
  id: string;
  displayName: string | null;
  role: MemberRole;
  user: { nickname: string };
};

export type CurrentMember = { id: string; role: MemberRole };

/** 수정 화면에서 채워 넣을 기존 카드 값 */
export type EditableCard = {
  id: string;
  name: string;
  issuer: string | null;
  type: CardType;
  last4: string | null;
  color: string;
  ownerMemberId: string | null;
  billingDay: number | null;
  statementStartDay: number | null;
  statementEndDay: number | null;
  paymentAccountId: string | null;
  creditLimit: number | null;
};

export type EditableAccount = {
  id: string;
  name: string;
  type: AccountType;
  bankName: string | null;
  last4: string | null;
  balance: number;
  color: string;
  ownerMemberId: string | null;
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

/**
 * 관리자(ADMIN/OWNER)는 아무 구성원 것으로도 등록할 수 있고,
 * 구성원(MEMBER)은 본인 또는 공용만 고를 수 있다.
 * 서버(actions/asset.ts)에서도 같은 규칙을 다시 검사한다 — 화면만 막으면 안 되니까.
 */
function assignableMembers(members: AssetMember[], current: CurrentMember) {
  const isAdmin = current.role === "ADMIN" || current.role === "OWNER";
  return isAdmin ? members : members.filter((m) => m.id === current.id);
}

function memberLabel(member: AssetMember) {
  return member.displayName ?? member.user.nickname;
}

// ---------------------------------------------------------------------------
// 등록 화면 (카드 / 계좌 탭)
// ---------------------------------------------------------------------------

export function AssetForm({
  householdId,
  members,
  accounts,
  currentMember,
  defaultTab = "card",
}: {
  householdId: string;
  members: AssetMember[];
  accounts: { id: string; name: string; bankName: string | null }[];
  currentMember: CurrentMember;
  defaultTab?: "card" | "account";
}) {
  const [tab, setTab] = useState<"card" | "account">(defaultTab);

  return (
    <div className="pb-8">
      <FormHeader title="카드 / 계좌 등록" />

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
            currentMember={currentMember}
          />
        ) : (
          <AccountForm
            householdId={householdId}
            members={members}
            currentMember={currentMember}
          />
        )}
      </div>
    </div>
  );
}

/** 수정 화면 (카드) */
export function CardEditScreen(props: {
  members: AssetMember[];
  accounts: { id: string; name: string; bankName: string | null }[];
  currentMember: CurrentMember;
  card: EditableCard;
}) {
  return (
    <div className="pb-8">
      <FormHeader title="카드 수정" />
      <div className="px-4 py-4">
        <CardForm {...props} />
      </div>
    </div>
  );
}

/** 수정 화면 (계좌) */
export function AccountEditScreen(props: {
  members: AssetMember[];
  currentMember: CurrentMember;
  account: EditableAccount;
}) {
  return (
    <div className="pb-8">
      <FormHeader title="계좌 수정" />
      <div className="px-4 py-4">
        <AccountForm {...props} />
      </div>
    </div>
  );
}

function FormHeader({ title }: { title: string }) {
  const router = useRouter();

  return (
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
        <h1 className="text-base font-bold">{title}</h1>
        <div className="size-9" />
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// 카드 폼 (등록 / 수정 공용)
// ---------------------------------------------------------------------------

function CardForm({
  householdId,
  members,
  accounts,
  currentMember,
  card,
}: {
  householdId?: string;
  members: AssetMember[];
  accounts: { id: string; name: string; bankName: string | null }[];
  currentMember: CurrentMember;
  card?: EditableCard;
}) {
  const isEdit = Boolean(card);
  const [state, formAction] = useActionState(
    isEdit ? updateCard : createCard,
    null,
  );

  const [type, setType] = useState<CardType>(card?.type ?? "CREDIT");
  const [color, setColor] = useState(card?.color ?? CARD_COLORS[0]);

  const owners = assignableMembers(members, currentMember);
  const isAdmin = currentMember.role === "ADMIN" || currentMember.role === "OWNER";

  return (
    <form action={formAction} className="mt-5 space-y-5">
      {isEdit ? (
        <input type="hidden" name="cardId" value={card?.id} />
      ) : (
        <input type="hidden" name="householdId" value={householdId} />
      )}
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
              {option === "CREDIT" ? "신용" : option === "DEBIT" ? "체크" : "선불"}
            </button>
          ))}
        </div>
      </div>

      <Field label="카드사">
        <Select name="issuer" defaultValue={card?.issuer ?? ""}>
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
          defaultValue={card?.name ?? ""}
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
          defaultValue={card?.last4 ?? ""}
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
              defaultValue={card?.billingDay ?? 25}
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
                defaultValue={card?.statementStartDay ?? 12}
              />
            </Field>
            <Field label="이용기간 종료">
              <Input
                name="statementEndDay"
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                defaultValue={card?.statementEndDay ?? 11}
              />
            </Field>
          </div>

          <p className="text-xs leading-relaxed text-muted">
            보통 &ldquo;전월 12일 ~ 당월 11일 사용분을 25일에 결제&rdquo;처럼
            정해져 있어요. 카드사 앱에서 확인할 수 있습니다.
          </p>

          <Field label="결제 계좌 (선택)">
            <Select
              name="paymentAccountId"
              defaultValue={card?.paymentAccountId ?? ""}
            >
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

      {/*
        체크카드는 결제일·이용기간이 없다. 대신 연결 계좌가 중요하다 —
        긁는 즉시 이 계좌에서 잔액이 빠지도록 처리한다.
      */}
      {type === "DEBIT" && (
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-bold">연결 계좌</p>

          <Field
            label="출금 계좌"
            hint="이 카드로 결제하면 선택한 계좌에서 바로 빠져나갑니다."
          >
            <Select
              name="paymentAccountId"
              defaultValue={card?.paymentAccountId ?? ""}
            >
              <option value="">선택 안 함</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.bankName ? `${account.bankName} ` : ""}
                  {account.name}
                </option>
              ))}
            </Select>
          </Field>

          {accounts.length === 0 && (
            <p className="text-xs text-warning">
              등록된 계좌가 없어요. 계좌를 먼저 등록하면 연결할 수 있습니다.
            </p>
          )}
        </div>
      )}

      <OwnerField
        owners={owners}
        isAdmin={isAdmin}
        defaultValue={card?.ownerMemberId ?? ""}
        label="누구 카드인가요?"
      />

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
        {isEdit ? "저장하기" : "카드 등록하기"}
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
// 계좌 폼 (등록 / 수정 공용)
// ---------------------------------------------------------------------------

function AccountForm({
  householdId,
  members,
  currentMember,
  account,
}: {
  householdId?: string;
  members: AssetMember[];
  currentMember: CurrentMember;
  account?: EditableAccount;
}) {
  const isEdit = Boolean(account);
  const [state, formAction] = useActionState(
    isEdit ? updateAccount : createAccount,
    null,
  );

  const [color, setColor] = useState(account?.color ?? "#0ea5e9");

  const owners = assignableMembers(members, currentMember);
  const isAdmin = currentMember.role === "ADMIN" || currentMember.role === "OWNER";

  return (
    <form action={formAction} className="mt-5 space-y-5">
      {isEdit ? (
        <input type="hidden" name="accountId" value={account?.id} />
      ) : (
        <input type="hidden" name="householdId" value={householdId} />
      )}
      <input type="hidden" name="color" value={color} />

      <Field label="계좌 종류">
        <Select name="type" defaultValue={account?.type ?? "CHECKING"}>
          {Object.entries(ACCOUNT_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="은행">
        <Select name="bankName" defaultValue={account?.bankName ?? ""}>
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
          defaultValue={account?.name ?? ""}
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
          defaultValue={account?.last4 ?? ""}
          autoComplete="off"
        />
      </Field>

      <Field label="현재 잔액 (원)">
        <Input
          name="balance"
          type="number"
          inputMode="numeric"
          defaultValue={account ? Math.abs(account.balance) : 0}
          className="text-right"
        />
      </Field>

      <OwnerField
        owners={owners}
        isAdmin={isAdmin}
        defaultValue={account?.ownerMemberId ?? ""}
        label="누구 계좌인가요?"
      />

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
        {isEdit ? "저장하기" : "계좌 등록하기"}
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------

function OwnerField({
  owners,
  isAdmin,
  defaultValue,
  label,
}: {
  owners: AssetMember[];
  isAdmin: boolean;
  defaultValue: string;
  label: string;
}) {
  return (
    <Field
      label={label}
      hint={
        isAdmin
          ? "관리자는 구성원 누구의 것으로도 지정할 수 있어요."
          : "구성원은 본인 또는 공용으로만 지정할 수 있어요."
      }
    >
      <Select name="ownerMemberId" defaultValue={defaultValue}>
        <option value="">공용</option>
        {owners.map((member) => (
          <option key={member.id} value={member.id}>
            {memberLabel(member)}
          </option>
        ))}
      </Select>
    </Field>
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
              value === option &&
                "ring-2 ring-foreground ring-offset-2 ring-offset-[var(--background)]",
            )}
            style={{ backgroundColor: option }}
          />
        ))}
      </div>
    </div>
  );
}
