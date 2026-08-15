import type { Prisma } from "@/generated/prisma/client";
import { buildInstallmentSchedule } from "@/lib/billing";
import type { PaymentMethod, TransactionType } from "@/generated/prisma/enums";

/**
 * 거래 생성의 공통 코어.
 *
 * "거래 한 건을 만들면 따라오는 부수효과"가 세 군데(수동 등록, 수정, 자동 수집)
 * 에서 똑같이 필요해서 여기로 모았다.
 *   - 신용카드 지출이면 회차별 청구 스케줄 생성
 *   - 즉시 출금 건이면 계좌 잔액 반영
 *
 * 반드시 prisma.$transaction 안에서 호출한다.
 */

export type CardForEffect = {
  id: string;
  type: "CREDIT" | "DEBIT" | "PREPAID";
  paymentAccountId: string | null;
  billingDay: number | null;
  statementStartDay: number | null;
  statementEndDay: number | null;
};

/**
 * 카드 종류에 따라 "계좌에서 즉시 빠지는지"와 "할부가 되는지"를 정리한다.
 *
 *   신용   : 결제일에 청구 → accountId 없음, 할부 가능
 *   체크   : 즉시 출금    → 연결 계좌를 accountId 로, 할부 없음
 *   선불   : 충전액에서   → accountId 없음, 할부 없음
 */
export function resolveCardEffect({
  card,
  requestedAccountId,
  requestedInstallments,
}: {
  card: CardForEffect | null;
  requestedAccountId: string | null;
  requestedInstallments: number;
}) {
  if (!card) {
    return {
      accountId: requestedAccountId,
      installmentMonths: 1,
      isCreditCard: false,
    };
  }

  if (card.type === "CREDIT") {
    return {
      accountId: null,
      installmentMonths: requestedInstallments,
      isCreditCard: true,
    };
  }

  if (card.type === "DEBIT") {
    return {
      accountId: card.paymentAccountId ?? requestedAccountId,
      installmentMonths: 1,
      isCreditCard: false,
    };
  }

  // PREPAID
  return { accountId: null, installmentMonths: 1, isCreditCard: false };
}

export type InsertTransactionInput = {
  householdId: string;
  type: TransactionType;
  amount: number;
  occurredAt: Date;
  merchant: string | null;
  memo: string | null;
  categoryId: string | null;
  paymentMethod: PaymentMethod;
  card: CardForEffect | null;
  /** resolveCardEffect 를 거친 값 */
  accountId: string | null;
  toAccountId: string | null;
  installmentMonths: number;
  isInterestFree: boolean;
  interestAmount: number;
  approvalNo: string | null;
  payerMemberId: string | null;
  createdByMemberId: string | null;
  isShared: boolean;
  excludeFromStats: boolean;
};

export async function insertTransactionWithEffects(
  db: Prisma.TransactionClient,
  input: InsertTransactionInput,
) {
  const created = await db.transaction.create({
    data: {
      householdId: input.householdId,
      type: input.type,
      amount: input.amount,
      occurredAt: input.occurredAt,
      merchant: input.merchant,
      memo: input.memo,
      categoryId: input.categoryId,
      paymentMethod: input.paymentMethod,
      cardId: input.card?.id ?? null,
      accountId: input.accountId,
      toAccountId: input.toAccountId,
      installmentMonths: input.installmentMonths,
      isInterestFree: input.isInterestFree,
      interestAmount: input.isInterestFree ? 0 : input.interestAmount,
      approvalNo: input.approvalNo,
      payerMemberId: input.payerMemberId,
      createdByMemberId: input.createdByMemberId,
      isShared: input.isShared,
      excludeFromStats: input.excludeFromStats,
    },
  });

  // 신용카드 지출만 청구 스케줄을 만든다.
  // 일시불도 1회차짜리로 남겨야 "이번 달 카드값"을 한 번에 계산할 수 있다.
  if (input.card?.type === "CREDIT" && input.type === "EXPENSE") {
    const rounds = buildInstallmentSchedule({
      amount: input.amount,
      months: input.installmentMonths,
      purchaseDate: input.occurredAt,
      card: input.card,
      interestAmount: input.isInterestFree ? 0 : input.interestAmount,
    });

    await db.installmentPlan.createMany({
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

  // accountId 가 있으면 그 계좌에서 즉시 빠지는(또는 들어오는) 건이다.
  if (input.type === "TRANSFER") {
    if (input.accountId) {
      await db.account.update({
        where: { id: input.accountId },
        data: { balance: { decrement: input.amount } },
      });
    }
    if (input.toAccountId) {
      await db.account.update({
        where: { id: input.toAccountId },
        data: { balance: { increment: input.amount } },
      });
    }
  } else if (input.accountId) {
    await db.account.update({
      where: { id: input.accountId },
      data:
        input.type === "INCOME"
          ? { balance: { increment: input.amount } }
          : { balance: { decrement: input.amount } },
    });
  }

  return created;
}
