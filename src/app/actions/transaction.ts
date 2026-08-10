"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth";
import { buildInstallmentSchedule } from "@/lib/billing";
import type { ActionState } from "./household";

const transactionSchema = z
  .object({
    householdId: z.string().uuid(),
    type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
    amount: z.coerce
      .number()
      .int("금액은 원 단위로 입력해 주세요.")
      .positive("금액을 입력해 주세요."),
    occurredAt: z.coerce.date(),
    merchant: z.string().trim().max(60).optional().or(z.literal("")),
    memo: z.string().trim().max(200).optional().or(z.literal("")),
    categoryId: z.string().uuid().optional().or(z.literal("")),

    paymentMethod: z.enum([
      "CASH",
      "CARD",
      "BANK_TRANSFER",
      "AUTO_DEBIT",
      "MOBILE_PAY",
      "POINT",
      "GIFT_CARD",
      "OTHER",
    ]),
    cardId: z.string().uuid().optional().or(z.literal("")),
    accountId: z.string().uuid().optional().or(z.literal("")),
    toAccountId: z.string().uuid().optional().or(z.literal("")),

    installmentMonths: z.coerce.number().int().min(1).max(60).default(1),
    isInterestFree: z.coerce.boolean().default(true),
    interestAmount: z.coerce.number().int().min(0).default(0),
    approvalNo: z.string().trim().max(30).optional().or(z.literal("")),

    payerMemberId: z.string().uuid().optional().or(z.literal("")),
    isShared: z.coerce.boolean().default(true),
    excludeFromStats: z.coerce.boolean().default(false),
  })
  .refine((data) => data.paymentMethod !== "CARD" || Boolean(data.cardId), {
    message: "어떤 카드로 결제했는지 선택해 주세요.",
    path: ["cardId"],
  })
  .refine((data) => data.type !== "TRANSFER" || Boolean(data.toAccountId), {
    message: "이체받을 계좌를 선택해 주세요.",
    path: ["toAccountId"],
  });

/** 빈 문자열을 null 로 바꿔주는 헬퍼 (form 에서 미선택은 "" 로 들어온다) */
function nullify(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

export async function createTransaction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;

  const parsed = transactionSchema.safeParse({
    ...raw,
    isInterestFree: raw.isInterestFree === "on" || raw.isInterestFree === "true",
    isShared: raw.isShared !== "false",
    excludeFromStats:
      raw.excludeFromStats === "on" || raw.excludeFromStats === "true",
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const data = parsed.data;
  const { member } = await requireMembership(data.householdId, "MEMBER");

  const cardId = nullify(data.cardId);
  const accountId = nullify(data.accountId);
  const toAccountId = nullify(data.toAccountId);

  // 카드 결제가 아니면 할부는 의미가 없다
  const installmentMonths =
    data.paymentMethod === "CARD" || data.paymentMethod === "MOBILE_PAY"
      ? data.installmentMonths
      : 1;

  await prisma.$transaction(async (tx) => {
    const created = await tx.transaction.create({
      data: {
        householdId: data.householdId,
        type: data.type,
        amount: data.amount,
        occurredAt: data.occurredAt,
        merchant: nullify(data.merchant),
        memo: nullify(data.memo),
        categoryId: nullify(data.categoryId),
        paymentMethod: data.paymentMethod,
        cardId,
        accountId,
        toAccountId,
        installmentMonths,
        isInterestFree: data.isInterestFree,
        interestAmount: data.isInterestFree ? 0 : data.interestAmount,
        approvalNo: nullify(data.approvalNo),
        payerMemberId: nullify(data.payerMemberId) ?? member.id,
        createdByMemberId: member.id,
        isShared: data.isShared,
        excludeFromStats: data.excludeFromStats,
      },
    });

    // 카드 결제면 회차별 청구 스케줄을 만들어 둔다.
    // 일시불도 1회차짜리로 남겨야 "이번 달 카드값"을 한 번에 계산할 수 있다.
    if (cardId && data.type === "EXPENSE") {
      const card = await tx.card.findUnique({ where: { id: cardId } });

      if (card) {
        const rounds = buildInstallmentSchedule({
          amount: data.amount,
          months: installmentMonths,
          purchaseDate: data.occurredAt,
          card,
          interestAmount: data.isInterestFree ? 0 : data.interestAmount,
        });

        await tx.installmentPlan.createMany({
          data: rounds.map((round) => ({
            transactionId: created.id,
            round: round.round,
            totalRounds: round.totalRounds,
            amount: round.amount,
            interest: round.interest,
            billingDate: round.billingDate,
          })),
        });
      }
    }

    // 현금/계좌에서 바로 나가는 건은 잔액에 즉시 반영한다.
    // (카드 결제는 나중에 카드값이 빠져나갈 때 반영)
    if (data.type === "TRANSFER") {
      if (accountId) {
        await tx.account.update({
          where: { id: accountId },
          data: { balance: { decrement: data.amount } },
        });
      }
      if (toAccountId) {
        await tx.account.update({
          where: { id: toAccountId },
          data: { balance: { increment: data.amount } },
        });
      }
    } else if (accountId && data.paymentMethod !== "CARD") {
      await tx.account.update({
        where: { id: accountId },
        data:
          data.type === "INCOME"
            ? { balance: { increment: data.amount } }
            : { balance: { decrement: data.amount } },
      });
    }
  });

  revalidatePath("/", "layout");
  redirect("/transactions");
}

export async function deleteTransaction(transactionId: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
  });
  if (!transaction) return { error: "내역을 찾을 수 없어요." };

  await requireMembership(transaction.householdId, "MEMBER");

  await prisma.$transaction(async (tx) => {
    // 잔액 원복
    if (transaction.type === "TRANSFER") {
      if (transaction.accountId) {
        await tx.account.update({
          where: { id: transaction.accountId },
          data: { balance: { increment: transaction.amount } },
        });
      }
      if (transaction.toAccountId) {
        await tx.account.update({
          where: { id: transaction.toAccountId },
          data: { balance: { decrement: transaction.amount } },
        });
      }
    } else if (
      transaction.accountId &&
      transaction.paymentMethod !== "CARD"
    ) {
      await tx.account.update({
        where: { id: transaction.accountId },
        data:
          transaction.type === "INCOME"
            ? { balance: { decrement: transaction.amount } }
            : { balance: { increment: transaction.amount } },
      });
    }

    // InstallmentPlan 은 onDelete: Cascade 로 함께 지워진다
    await tx.transaction.delete({ where: { id: transactionId } });
  });

  revalidatePath("/", "layout");
  return { success: true };
}
