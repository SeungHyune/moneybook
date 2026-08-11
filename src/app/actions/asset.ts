"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canAssignOwner, canManageAsset, requireMembership } from "@/lib/auth";
import type { ActionState } from "./household";

function nullify(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

/** 지정한 구성원이 이 가구 사람인지 확인 (남의 가구 구성원 id 를 끼워넣지 못하게) */
async function assertMemberOfHousehold(
  householdId: string,
  memberId: string | null,
) {
  if (!memberId) return;

  const exists = await prisma.householdMember.findFirst({
    where: { id: memberId, householdId },
    select: { id: true },
  });

  if (!exists) throw new Error("잘못된 구성원 지정이에요.");
}

// ---------------------------------------------------------------------------
// 카드
// ---------------------------------------------------------------------------

const cardFields = {
  name: z.string().trim().min(1, "카드 이름을 입력해 주세요.").max(30),
  issuer: z.string().trim().max(20).optional().or(z.literal("")),
  type: z.enum(["CREDIT", "DEBIT", "PREPAID"]),
  last4: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, "카드 끝 4자리를 숫자로 입력해 주세요.")
    .optional()
    .or(z.literal("")),
  color: z.string().trim().default("#8b5cf6"),
  ownerMemberId: z.string().uuid().optional().or(z.literal("")),

  billingDay: z.coerce.number().int().min(1).max(31).optional(),
  statementStartDay: z.coerce.number().int().min(1).max(31).optional(),
  statementEndDay: z.coerce.number().int().min(1).max(31).optional(),
  paymentAccountId: z.string().uuid().optional().or(z.literal("")),
  creditLimit: z.coerce.number().int().min(0).optional(),
};

const createCardSchema = z
  .object({ householdId: z.string().uuid(), ...cardFields })
  .refine((data) => data.type !== "CREDIT" || Boolean(data.billingDay), {
    message: "신용카드는 결제일을 입력해 주세요.",
    path: ["billingDay"],
  });

const updateCardSchema = z
  .object({ cardId: z.string().uuid(), ...cardFields })
  .refine((data) => data.type !== "CREDIT" || Boolean(data.billingDay), {
    message: "신용카드는 결제일을 입력해 주세요.",
    path: ["billingDay"],
  });

/** form 의 빈 문자열을 undefined 로 바꿔 zod 기본값이 먹게 한다 */
function normalizeCardInput(raw: Record<string, string>) {
  return {
    ...raw,
    billingDay: raw.billingDay || undefined,
    statementStartDay: raw.statementStartDay || undefined,
    statementEndDay: raw.statementEndDay || undefined,
    creditLimit: raw.creditLimit || undefined,
  };
}

export async function createCard(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = createCardSchema.safeParse(normalizeCardInput(raw));

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const data = parsed.data;
  const { member } = await requireMembership(data.householdId, "MEMBER");

  const ownerMemberId = nullify(data.ownerMemberId);

  // 구성원은 본인 또는 공용으로만 등록할 수 있다
  if (!canAssignOwner(member, ownerMemberId)) {
    return { error: "구성원은 본인 또는 공용으로만 등록할 수 있어요." };
  }
  await assertMemberOfHousehold(data.householdId, ownerMemberId);

  await prisma.card.create({
    data: {
      householdId: data.householdId,
      name: data.name,
      issuer: nullify(data.issuer),
      type: data.type,
      last4: nullify(data.last4),
      color: data.color,
      ownerMemberId,
      createdByMemberId: member.id,
      billingDay: data.type === "CREDIT" ? (data.billingDay ?? null) : null,
      statementStartDay: data.statementStartDay ?? null,
      statementEndDay: data.statementEndDay ?? null,
      paymentAccountId: nullify(data.paymentAccountId),
      creditLimit: data.creditLimit ?? null,
    },
  });

  revalidatePath("/", "layout");
  redirect("/cards");
}

export async function updateCard(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = updateCardSchema.safeParse(normalizeCardInput(raw));

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const data = parsed.data;

  const card = await prisma.card.findUnique({ where: { id: data.cardId } });
  if (!card) return { error: "카드를 찾을 수 없어요." };

  const { member } = await requireMembership(card.householdId, "MEMBER");

  if (!canManageAsset(member, card)) {
    return { error: "본인이 등록한 카드만 수정할 수 있어요." };
  }

  const ownerMemberId = nullify(data.ownerMemberId);
  if (!canAssignOwner(member, ownerMemberId)) {
    return { error: "구성원은 본인 또는 공용으로만 지정할 수 있어요." };
  }
  await assertMemberOfHousehold(card.householdId, ownerMemberId);

  await prisma.card.update({
    where: { id: data.cardId },
    data: {
      name: data.name,
      issuer: nullify(data.issuer),
      type: data.type,
      last4: nullify(data.last4),
      color: data.color,
      ownerMemberId,
      billingDay: data.type === "CREDIT" ? (data.billingDay ?? null) : null,
      statementStartDay: data.statementStartDay ?? null,
      statementEndDay: data.statementEndDay ?? null,
      paymentAccountId: nullify(data.paymentAccountId),
      creditLimit: data.creditLimit ?? null,
    },
  });

  revalidatePath("/", "layout");
  redirect("/cards");
}

export async function deleteCard(cardId: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { error: "카드를 찾을 수 없어요." };

  const { member } = await requireMembership(card.householdId, "MEMBER");

  if (!canManageAsset(member, card)) {
    return { error: "본인이 등록한 카드만 삭제할 수 있어요." };
  }

  // 거래는 남기고 카드 연결만 끊는다 (스키마의 onDelete: SetNull)
  await prisma.card.delete({ where: { id: cardId } });

  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 계좌
// ---------------------------------------------------------------------------

const accountFields = {
  name: z.string().trim().min(1, "계좌 이름을 입력해 주세요.").max(30),
  type: z.enum(["CHECKING", "SAVINGS", "CASH", "INVESTMENT", "LOAN", "OTHER"]),
  bankName: z.string().trim().max(20).optional().or(z.literal("")),
  last4: z
    .string()
    .trim()
    .regex(/^\d{0,4}$/, "계좌 끝 4자리를 숫자로 입력해 주세요.")
    .optional()
    .or(z.literal("")),
  balance: z.coerce.number().int().default(0),
  color: z.string().trim().default("#0ea5e9"),
  ownerMemberId: z.string().uuid().optional().or(z.literal("")),
};

const createAccountSchema = z.object({
  householdId: z.string().uuid(),
  ...accountFields,
});

const updateAccountSchema = z.object({
  accountId: z.string().uuid(),
  ...accountFields,
});

export async function createAccount(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = createAccountSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const data = parsed.data;
  const { member } = await requireMembership(data.householdId, "MEMBER");

  const ownerMemberId = nullify(data.ownerMemberId);

  if (!canAssignOwner(member, ownerMemberId)) {
    return { error: "구성원은 본인 또는 공용으로만 등록할 수 있어요." };
  }
  await assertMemberOfHousehold(data.householdId, ownerMemberId);

  await prisma.account.create({
    data: {
      householdId: data.householdId,
      name: data.name,
      type: data.type,
      bankName: nullify(data.bankName),
      last4: nullify(data.last4),
      // 대출 계좌는 음수로 관리한다
      balance: data.type === "LOAN" ? -Math.abs(data.balance) : data.balance,
      color: data.color,
      ownerMemberId,
      createdByMemberId: member.id,
    },
  });

  revalidatePath("/", "layout");
  redirect("/cards");
}

export async function updateAccount(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateAccountSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const data = parsed.data;

  const account = await prisma.account.findUnique({
    where: { id: data.accountId },
  });
  if (!account) return { error: "계좌를 찾을 수 없어요." };

  const { member } = await requireMembership(account.householdId, "MEMBER");

  if (!canManageAsset(member, account)) {
    return { error: "본인이 등록한 계좌만 수정할 수 있어요." };
  }

  const ownerMemberId = nullify(data.ownerMemberId);
  if (!canAssignOwner(member, ownerMemberId)) {
    return { error: "구성원은 본인 또는 공용으로만 지정할 수 있어요." };
  }
  await assertMemberOfHousehold(account.householdId, ownerMemberId);

  await prisma.account.update({
    where: { id: data.accountId },
    data: {
      name: data.name,
      type: data.type,
      bankName: nullify(data.bankName),
      last4: nullify(data.last4),
      balance: data.type === "LOAN" ? -Math.abs(data.balance) : data.balance,
      color: data.color,
      ownerMemberId,
    },
  });

  revalidatePath("/", "layout");
  redirect("/cards");
}

export async function deleteAccount(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "계좌를 찾을 수 없어요." };

  const { member } = await requireMembership(account.householdId, "MEMBER");

  if (!canManageAsset(member, account)) {
    return { error: "본인이 등록한 계좌만 삭제할 수 있어요." };
  }

  await prisma.account.delete({ where: { id: accountId } });

  revalidatePath("/", "layout");
  return { success: true };
}
