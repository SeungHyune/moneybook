"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageAsset, requireMembership } from "@/lib/auth";
import { getUpcomingStatementPeriod } from "@/lib/billing";
import { dayOfMonthToDate, fromYearMonth } from "@/lib/utils";
import type { ActionState } from "./household";

/**
 * 신용카드를 등록할 때 "이미 쓴 카드값" 등록.
 *
 * 앱을 시작한 시점에 이미 결제해둔 건 지난 내역을 하나하나 넣기 어렵다.
 * 그래서 갚아야 할 금액만 받아서 청구 스케줄을 만들어 준다.
 *
 * 구현은 일반 결제와 똑같은 모양으로 만든다 — 거래 한 건 + 회차별
 * InstallmentPlan. 그래야 청구서·홈 카드값·납부 처리가 전부 그대로 동작한다.
 * 다만 과거에 이미 쓴 돈이므로 통계에서는 제외한다(excludeFromStats).
 */

const installmentSchema = z.object({
  label: z.string().trim().max(40).optional().or(z.literal("")),
  /** 매월 빠지는 금액 */
  monthly: z.coerce.number().int().positive(),
  /** 남은 회차 (이번 청구부터 몇 번 더 내는지) */
  remaining: z.coerce.number().int().min(1).max(60),
  /** 전체 회차 (표시용, 없으면 남은 회차와 동일하게 본다) */
  totalRounds: z.coerce.number().int().min(1).max(60).optional(),
});

const schema = z.object({
  cardId: z.string().uuid(),
  /** 이번 결제일에 나갈 일시불 합계 */
  lumpSum: z.coerce.number().int().min(0).default(0),
  installments: z.array(installmentSchema).max(20).default([]),
});

export async function registerCardOpeningBalance(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  // installments 는 JSON 문자열로 넘어온다 (동적 행이라 form 필드로 풀기 번거롭다)
  let installmentsRaw: unknown = [];
  try {
    const raw = formData.get("installments");
    installmentsRaw = raw ? JSON.parse(String(raw)) : [];
  } catch {
    return { error: "할부 정보를 확인해 주세요." };
  }

  const parsed = schema.safeParse({
    cardId: formData.get("cardId"),
    lumpSum: formData.get("lumpSum") || 0,
    installments: installmentsRaw,
  });

  if (!parsed.success) {
    return { error: "입력값을 확인해 주세요." };
  }

  const { cardId, lumpSum, installments } = parsed.data;

  if (lumpSum === 0 && installments.length === 0) {
    return { error: "일시불 금액이나 할부를 하나 이상 입력해 주세요." };
  }

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { error: "카드를 찾을 수 없어요." };
  if (card.type !== "CREDIT" || !card.billingDay) {
    return { error: "신용카드만 등록할 수 있어요." };
  }

  const { member } = await requireMembership(card.householdId, "MEMBER");
  if (!canManageAsset(member, card)) {
    return { error: "본인이 등록한 카드만 수정할 수 있어요." };
  }

  // 기준: 아직 오지 않은 가장 가까운 결제일
  const upcoming = getUpcomingStatementPeriod(card);
  if (!upcoming) return { error: "카드 결제일을 먼저 설정해 주세요." };

  const baseYearMonth = upcoming.yearMonth;

  /** n개월 뒤 결제일 (말일 보정 포함) */
  const billingDateAfter = (monthsLater: number) => {
    const base = fromYearMonth(baseYearMonth);
    const target = new Date(base.getFullYear(), base.getMonth() + monthsLater, 1);
    return dayOfMonthToDate(
      target.getFullYear(),
      target.getMonth() + 1,
      card.billingDay!,
    );
  };

  await prisma.$transaction(async (tx) => {
    // --- 일시불: 이번 결제일에 한 번 ---
    if (lumpSum > 0) {
      const transaction = await tx.transaction.create({
        data: {
          householdId: card.householdId,
          type: "EXPENSE",
          amount: lumpSum,
          // 이번 청구 기간 안의 날짜로 둔다 (기간 표시와 어긋나지 않게)
          occurredAt: upcoming.periodEnd,
          merchant: `${card.name} 기존 사용분`,
          memo: "카드 등록 시 입력한 기존 카드값 (일시불)",
          paymentMethod: "CARD",
          cardId: card.id,
          installmentMonths: 1,
          payerMemberId: card.ownerMemberId ?? member.id,
          createdByMemberId: member.id,
          // 과거에 이미 쓴 돈이라 이번 달 지출 통계에는 넣지 않는다
          excludeFromStats: true,
        },
      });

      await tx.installmentPlan.create({
        data: {
          transactionId: transaction.id,
          round: 1,
          totalRounds: 1,
          amount: lumpSum,
          billingDate: billingDateAfter(0),
        },
      });
    }

    // --- 할부: 남은 회차만큼 매월 ---
    for (const item of installments) {
      const totalRounds = item.totalRounds ?? item.remaining;
      const firstRound = Math.max(1, totalRounds - item.remaining + 1);

      const transaction = await tx.transaction.create({
        data: {
          householdId: card.householdId,
          type: "EXPENSE",
          amount: item.monthly * item.remaining,
          occurredAt: upcoming.periodEnd,
          merchant: item.label || `${card.name} 기존 할부`,
          memo: `카드 등록 시 입력한 기존 할부 (${item.remaining}회 남음)`,
          paymentMethod: "CARD",
          cardId: card.id,
          installmentMonths: totalRounds,
          payerMemberId: card.ownerMemberId ?? member.id,
          createdByMemberId: member.id,
          excludeFromStats: true,
        },
      });

      await tx.installmentPlan.createMany({
        data: Array.from({ length: item.remaining }, (_, index) => ({
          transactionId: transaction.id,
          round: firstRound + index,
          totalRounds,
          amount: item.monthly,
          billingDate: billingDateAfter(index),
        })),
      });
    }
  });

  revalidatePath("/", "layout");
  redirect(`/cards/${cardId}`);
}
