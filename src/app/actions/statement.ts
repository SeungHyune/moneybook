"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth";
import { getStatementPeriod } from "@/lib/billing";
import type { ActionState } from "./household";

/**
 * 신용카드 대금 납부 처리.
 *
 * 카드값은 이미 각 결제 건이 지출로 잡혀 있으므로, 대금 납부를 또 지출로 세면
 * 이중 계산이 된다. 그래서 통장에서 빠진 사실만 남기고(excludeFromStats)
 * 계좌 잔액을 깎는다.
 */

const paySchema = z.object({
  cardId: z.string().uuid(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  /** 실제로 빠져나간 금액 (일부 결제·리볼빙 대비해 수정 가능) */
  amount: z.coerce.number().int().min(0),
  /** 결제 계좌. 비우면 카드에 연결된 계좌를 쓴다 */
  accountId: z.string().uuid().optional().or(z.literal("")),
});

export async function payCardStatement(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = paySchema.safeParse({
    cardId: formData.get("cardId"),
    yearMonth: formData.get("yearMonth"),
    amount: formData.get("amount"),
    accountId: formData.get("accountId") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "결제 정보를 확인해 주세요." };
  }

  const { cardId, yearMonth, amount } = parsed.data;

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { error: "카드를 찾을 수 없어요." };

  if (card.type !== "CREDIT") {
    return { error: "신용카드만 대금 납부를 기록할 수 있어요." };
  }

  const { member } = await requireMembership(card.householdId, "MEMBER");

  const accountId = parsed.data.accountId || card.paymentAccountId;
  if (!accountId) {
    return {
      error: "결제 계좌가 없어요. 카드 수정에서 출금 통장을 연결해 주세요.",
    };
  }

  // 남의 가구 계좌를 지정하지 못하게 확인
  const account = await prisma.account.findFirst({
    where: { id: accountId, householdId: card.householdId },
  });
  if (!account) return { error: "결제 계좌를 찾을 수 없어요." };

  const period = getStatementPeriod(card, yearMonth);
  if (!period) return { error: "카드 결제일이 설정되지 않았어요." };

  const existing = await prisma.cardStatement.findUnique({
    where: { cardId_yearMonth: { cardId, yearMonth } },
  });
  if (existing?.isPaid) {
    return { error: "이미 결제 처리된 청구서예요." };
  }

  // 청구액을 일시불/할부로 나눠 기록해 둔다
  const plans = await prisma.installmentPlan.findMany({
    where: {
      transaction: { cardId, householdId: card.householdId },
      billingDate: {
        gte: new Date(period.billingDate.getFullYear(), period.billingDate.getMonth(), 1),
        lte: new Date(
          period.billingDate.getFullYear(),
          period.billingDate.getMonth() + 1,
          0,
          23,
          59,
          59,
          999,
        ),
      },
    },
    select: { amount: true, totalRounds: true },
  });

  const lumpSumAmount = plans
    .filter((plan) => plan.totalRounds === 1)
    .reduce((sum, plan) => sum + plan.amount, 0);
  const installmentAmount = plans
    .filter((plan) => plan.totalRounds > 1)
    .reduce((sum, plan) => sum + plan.amount, 0);

  await prisma.$transaction(async (tx) => {
    await tx.cardStatement.upsert({
      where: { cardId_yearMonth: { cardId, yearMonth } },
      create: {
        householdId: card.householdId,
        cardId,
        yearMonth,
        billingDate: period.billingDate,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        lumpSumAmount,
        installmentAmount,
        totalAmount: amount,
        isPaid: true,
        paidAt: new Date(),
      },
      update: {
        billingDate: period.billingDate,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        lumpSumAmount,
        installmentAmount,
        totalAmount: amount,
        isPaid: true,
        paidAt: new Date(),
      },
    });

    await tx.account.update({
      where: { id: accountId },
      data: { balance: { decrement: amount } },
    });

    // 통장에서 빠진 이력만 남긴다. 통계에는 넣지 않는다 (개별 결제가 이미 지출로 잡혀 있다)
    await tx.transaction.create({
      data: {
        householdId: card.householdId,
        type: "EXPENSE",
        amount,
        occurredAt: period.billingDate,
        merchant: `${card.name} 대금`,
        memo: `${yearMonth} 카드대금 납부`,
        paymentMethod: "AUTO_DEBIT",
        accountId,
        payerMemberId: member.id,
        createdByMemberId: member.id,
        excludeFromStats: true,
      },
    });
  });

  revalidatePath("/", "layout");
  return { success: "카드대금을 납부 처리했어요." };
}

/** 잘못 누른 경우 되돌리기 */
export async function cancelCardStatementPayment(
  cardId: string,
  yearMonth: string,
) {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { error: "카드를 찾을 수 없어요." };

  await requireMembership(card.householdId, "MEMBER");

  const statement = await prisma.cardStatement.findUnique({
    where: { cardId_yearMonth: { cardId, yearMonth } },
  });
  if (!statement?.isPaid) return { error: "납부 기록이 없어요." };

  await prisma.$transaction(async (tx) => {
    // 납부하며 만든 기록을 찾아 되돌린다
    const record = await tx.transaction.findFirst({
      where: {
        householdId: card.householdId,
        memo: `${yearMonth} 카드대금 납부`,
        merchant: `${card.name} 대금`,
        excludeFromStats: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (record?.accountId) {
      await tx.account.update({
        where: { id: record.accountId },
        data: { balance: { increment: record.amount } },
      });
    }
    if (record) {
      await tx.transaction.delete({ where: { id: record.id } });
    }

    await tx.cardStatement.update({
      where: { id: statement.id },
      data: { isPaid: false, paidAt: null },
    });
  });

  revalidatePath("/", "layout");
  return { success: true };
}
