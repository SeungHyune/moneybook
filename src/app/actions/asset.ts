"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth";
import type { ActionState } from "./household";

function nullify(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

// ---------------------------------------------------------------------------
// 카드
// ---------------------------------------------------------------------------

const cardSchema = z
  .object({
    householdId: z.string().uuid(),
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
  })
  .refine((data) => data.type !== "CREDIT" || Boolean(data.billingDay), {
    message: "신용카드는 결제일을 입력해 주세요.",
    path: ["billingDay"],
  });

export async function createCard(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;

  const parsed = cardSchema.safeParse({
    ...raw,
    billingDay: raw.billingDay || undefined,
    statementStartDay: raw.statementStartDay || undefined,
    statementEndDay: raw.statementEndDay || undefined,
    creditLimit: raw.creditLimit || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const data = parsed.data;
  await requireMembership(data.householdId, "MEMBER");

  await prisma.card.create({
    data: {
      householdId: data.householdId,
      name: data.name,
      issuer: nullify(data.issuer),
      type: data.type,
      last4: nullify(data.last4),
      color: data.color,
      ownerMemberId: nullify(data.ownerMemberId),
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

  await requireMembership(card.householdId, "ADMIN");

  // 거래는 남기고 카드 연결만 끊는다 (스키마의 onDelete: SetNull)
  await prisma.card.delete({ where: { id: cardId } });

  revalidatePath("/", "layout");
  return { success: true };
}

// ---------------------------------------------------------------------------
// 계좌
// ---------------------------------------------------------------------------

const accountSchema = z.object({
  householdId: z.string().uuid(),
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
});

export async function createAccount(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = accountSchema.safeParse(
    Object.fromEntries(formData) as Record<string, string>,
  );

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const data = parsed.data;
  await requireMembership(data.householdId, "MEMBER");

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
      ownerMemberId: nullify(data.ownerMemberId),
    },
  });

  revalidatePath("/", "layout");
  redirect("/cards");
}

export async function deleteAccount(accountId: string) {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return { error: "계좌를 찾을 수 없어요." };

  await requireMembership(account.householdId, "ADMIN");

  await prisma.account.delete({ where: { id: accountId } });

  revalidatePath("/", "layout");
  return { success: true };
}
