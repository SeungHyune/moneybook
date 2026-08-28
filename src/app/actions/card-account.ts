"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { canManageAsset, requireMembership } from "@/lib/auth";
import type { ActionState } from "./household";

/**
 * 신용카드 출금 통장 변경 + 과거 납부 건 소급 이동.
 *
 * 통장을 잘못 걸어둔 채 몇 달을 쓴 경우, 카드 설정만 바꾸면 이미 처리한
 * 카드대금은 옛 통장에 남아 잔액이 어긋난다. 반대로 "이번 달부터 통장을
 * 바꿨다"면 과거 건은 그대로 둬야 맞다. 어느 쪽인지는 사람만 아니까
 * "언제부터 이 통장이었는지"를 받아서 그 시점 이후만 옮긴다.
 *
 * 옮길 때 하는 일 (한 트랜잭션):
 *   - 대상 납부 거래의 accountId 를 새 통장으로
 *   - 옛 통장 잔액은 되돌리고(+), 새 통장에서 다시 뺀다(-)
 */

const schema = z.object({
  cardId: z.string().uuid(),
  /** 새 출금 통장. 빈 값이면 연결 해제 */
  accountId: z.string().uuid().optional().or(z.literal("")),
  /**
   * 소급 적용 시작 시점:
   *   "none"  - 지금부터만 (과거 건은 그대로)
   *   "all"   - 이 카드의 모든 납부 건
   *   "YYYY-MM-DD" - 그 날짜 이후 납부 건부터
   */
  applyFrom: z.string().default("none"),
});

export async function updateCardPaymentAccount(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({
    cardId: formData.get("cardId"),
    accountId: formData.get("accountId") ?? undefined,
    applyFrom: formData.get("applyFrom") ?? "none",
  });

  if (!parsed.success) return { error: "입력값을 확인해 주세요." };

  const { cardId, applyFrom } = parsed.data;
  const newAccountId = parsed.data.accountId || null;

  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return { error: "카드를 찾을 수 없어요." };

  const { member } = await requireMembership(card.householdId, "MEMBER");
  if (!canManageAsset(member, card)) {
    return { error: "본인이 등록한 카드만 수정할 수 있어요." };
  }

  if (newAccountId) {
    const account = await prisma.account.findFirst({
      where: { id: newAccountId, householdId: card.householdId },
      select: { id: true },
    });
    if (!account) return { error: "통장을 찾을 수 없어요." };
  }

  // 소급 대상 기간 계산
  let since: Date | null = null;
  if (applyFrom === "all") {
    since = new Date(0);
  } else if (applyFrom !== "none") {
    const parsedDate = new Date(applyFrom);
    if (Number.isNaN(parsedDate.getTime())) {
      return { error: "적용 시작일을 확인해 주세요." };
    }
    parsedDate.setHours(0, 0, 0, 0);
    since = parsedDate;
  }

  const moved = await prisma.$transaction(async (tx) => {
    await tx.card.update({
      where: { id: cardId },
      data: { paymentAccountId: newAccountId },
    });

    if (!since || !newAccountId) return 0;

    /*
     * 이 카드의 대금 납부 거래들 — payCardStatement 가 만든 것.
     * merchant 가 "<카드이름> 대금" 이고 통계 제외로 남아 있다.
     */
    const records = await tx.transaction.findMany({
      where: {
        householdId: card.householdId,
        merchant: `${card.name} 대금`,
        excludeFromStats: true,
        occurredAt: { gte: since },
        accountId: { not: newAccountId },
      },
      select: { id: true, amount: true, accountId: true },
    });

    for (const record of records) {
      // 옛 통장에서 빠졌던 금액을 되돌리고
      if (record.accountId) {
        await tx.account.update({
          where: { id: record.accountId },
          data: { balance: { increment: record.amount } },
        });
      }
      // 새 통장에서 빼고, 거래에도 새 통장을 기록한다
      await tx.account.update({
        where: { id: newAccountId },
        data: { balance: { decrement: record.amount } },
      });
      await tx.transaction.update({
        where: { id: record.id },
        data: { accountId: newAccountId },
      });
    }

    return records.length;
  });

  revalidatePath("/", "layout");

  if (moved > 0) {
    return {
      success: `출금 통장을 바꾸고, 지난 납부 ${moved}건도 새 통장으로 옮겼어요.`,
    };
  }
  return { success: "출금 통장을 변경했어요." };
}
