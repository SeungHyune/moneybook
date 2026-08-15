"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth";
import { buildInstallmentSchedule } from "@/lib/billing";
import {
  insertTransactionWithEffects,
  resolveCardEffect,
} from "@/lib/record-transaction";
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

/** 거래 한 건이 계좌 잔액에 준 영향 (양수면 잔액이 늘어야 한다) */
function balanceDelta(type: "INCOME" | "EXPENSE" | "TRANSFER", amount: number) {
  return type === "INCOME" ? amount : -amount;
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
  const toAccountId = nullify(data.toAccountId);

  // 카드 결제가 아니면 할부는 의미가 없다
  const requestedInstallments =
    data.paymentMethod === "CARD" || data.paymentMethod === "MOBILE_PAY"
      ? data.installmentMonths
      : 1;

  // 카드 종류에 따라 처리가 갈리므로 트랜잭션 밖에서 먼저 읽는다
  const card = cardId
    ? await prisma.card.findFirst({
        where: { id: cardId, householdId: data.householdId },
      })
    : null;

  /*
   * 카드 종류별 처리
   *
   *   신용(CREDIT) : 결제일에 한꺼번에 빠진다 → 회차 스케줄만 만들고 계좌는 그대로
   *   체크(DEBIT)  : 긁는 즉시 연결 계좌에서 빠진다 → 계좌를 깎고 청구서는 만들지 않는다
   *   선불(PREPAID): 미리 충전한 금액에서 빠진다 → 계좌·청구 모두 건드리지 않는다
   *
   * 체크카드는 실제로 빠져나간 계좌를 accountId 에 기록해 둔다.
   * 그러면 잔액 반영/원복이 "거래에 적힌 계좌"만 보고 처리돼서 어긋나지 않고,
   * 내역에서도 어느 통장에서 나갔는지 보여줄 수 있다.
   */
  const { accountId, installmentMonths } = resolveCardEffect({
    card,
    requestedAccountId: nullify(data.accountId),
    requestedInstallments,
  });

  // 자동 수집함에서 넘어온 경우, 등록되면 그 항목을 처리 완료로 표시한다
  const inboxId = nullify(raw.inboxId);

  await prisma.$transaction(async (tx) => {
    const created = await insertTransactionWithEffects(tx, {
      householdId: data.householdId,
      type: data.type,
      amount: data.amount,
      occurredAt: data.occurredAt,
      merchant: nullify(data.merchant),
      memo: nullify(data.memo),
      categoryId: nullify(data.categoryId),
      paymentMethod: data.paymentMethod,
      card,
      accountId,
      toAccountId,
      installmentMonths,
      isInterestFree: data.isInterestFree,
      interestAmount: data.interestAmount,
      approvalNo: nullify(data.approvalNo),
      payerMemberId: nullify(data.payerMemberId) ?? member.id,
      createdByMemberId: member.id,
      isShared: data.isShared,
      excludeFromStats: data.excludeFromStats,
    });

    if (inboxId) {
      await tx.ingestInbox.updateMany({
        where: { id: inboxId, userId: member.userId, status: "PENDING" },
        data: { status: "CONFIRMED", transactionId: created.id },
      });
    }
  });

  revalidatePath("/", "layout");
  redirect(inboxId ? "/inbox" : "/transactions");
}

const updateSchema = transactionSchema.safeExtend({
  transactionId: z.string().uuid(),
});

/**
 * 내역 수정.
 *
 * 잔액은 "이전 영향을 지우고 새 영향을 준다"로 처리한다.
 * 계좌나 카드가 바뀌어도 어긋나지 않게 하려면 이 순서가 안전하다.
 * 할부 스케줄도 통째로 다시 만든다.
 */
export async function updateTransaction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;

  const parsed = updateSchema.safeParse({
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

  const before = await prisma.transaction.findFirst({
    where: { id: data.transactionId, householdId: data.householdId },
  });
  if (!before) return { error: "내역을 찾을 수 없어요." };

  const { member } = await requireMembership(data.householdId, "MEMBER");

  const cardId = nullify(data.cardId);
  const toAccountId = nullify(data.toAccountId);

  const card = cardId
    ? await prisma.card.findFirst({
        where: { id: cardId, householdId: data.householdId },
      })
    : null;

  const requestedInstallments =
    data.paymentMethod === "CARD" || data.paymentMethod === "MOBILE_PAY"
      ? data.installmentMonths
      : 1;

  const { accountId, installmentMonths, isCreditCard } = resolveCardEffect({
    card,
    requestedAccountId: nullify(data.accountId),
    requestedInstallments,
  });

  await prisma.$transaction(async (tx) => {
    // 1) 이전 영향 되돌리기
    if (before.type === "TRANSFER") {
      if (before.accountId) {
        await tx.account.update({
          where: { id: before.accountId },
          data: { balance: { increment: before.amount } },
        });
      }
      if (before.toAccountId) {
        await tx.account.update({
          where: { id: before.toAccountId },
          data: { balance: { decrement: before.amount } },
        });
      }
    } else if (before.accountId) {
      await tx.account.update({
        where: { id: before.accountId },
        data: { balance: { decrement: balanceDelta(before.type, before.amount) } },
      });
    }

    await tx.installmentPlan.deleteMany({
      where: { transactionId: before.id },
    });

    // 2) 새 값 저장
    await tx.transaction.update({
      where: { id: before.id },
      data: {
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
        isShared: data.isShared,
        excludeFromStats: data.excludeFromStats,
      },
    });

    // 3) 새 영향 적용
    if (card && isCreditCard && data.type === "EXPENSE") {
      const rounds = buildInstallmentSchedule({
        amount: data.amount,
        months: installmentMonths,
        purchaseDate: data.occurredAt,
        card,
        interestAmount: data.isInterestFree ? 0 : data.interestAmount,
      });

      await tx.installmentPlan.createMany({
        data: rounds.map((round) => ({
          transactionId: before.id,
          round: round.round,
          totalRounds: round.totalRounds,
          amount: round.amount,
          interest: round.interest,
          billingDate: round.billingDate,
        })),
      });
    }

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
    } else if (accountId) {
      await tx.account.update({
        where: { id: accountId },
        data: { balance: { increment: balanceDelta(data.type, data.amount) } },
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

  /*
   * 등록할 때 잔액을 깎았던 건만 되돌린다.
   * 신용/선불카드 결제는 계좌를 건드리지 않았으므로 원복 대상이 아니다.
   * (등록 시 accountId 를 비워두지만, 이 규칙이 바뀌기 전에 쌓인 데이터도
   *  있을 수 있어 카드 종류를 한 번 더 확인한다)
   */
  const card = transaction.cardId
    ? await prisma.card.findUnique({
        where: { id: transaction.cardId },
        select: { type: true },
      })
    : null;

  const wasImmediateWithdrawal = !card || card.type === "DEBIT";

  await prisma.$transaction(async (tx) => {
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
    } else if (transaction.accountId && wasImmediateWithdrawal) {
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
