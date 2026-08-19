import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getFixedSchedule, getUpcomingCardPayments } from "@/lib/queries";
import { sendPushToHousehold } from "@/lib/push";
import { formatWonShort, toYearMonth } from "@/lib/utils";

/**
 * 매일 아침 리마인더 발송 (Vercel Cron → vercel.json 의 crons 참고).
 *
 * 보내는 것:
 *   - 오늘/내일이 예정일인 고정지출 (RecurringRule.notifyDaysBefore 반영)
 *   - D-1, D-day 인 신용카드 결제
 *
 * 같은 tag 로 보내므로 어제 알림이 남아 있어도 겹치지 않고 대체된다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 크론은 UTC 00:00 에 돌지만 사용자는 한국에 있다 → KST 기준 "오늘"
  const nowKst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayKst = new Date(
    Date.UTC(
      nowKst.getUTCFullYear(),
      nowKst.getUTCMonth(),
      nowKst.getUTCDate(),
    ),
  );

  const households = await prisma.household.findMany({ select: { id: true } });

  let totalSent = 0;

  for (const household of households) {
    // --- 고정지출: notifyDaysBefore 일 전이거나 당일이면 알린다 ---
    const yearMonth = toYearMonth(nowKst);
    const schedule = await getFixedSchedule(household.id, yearMonth);

    for (const item of schedule) {
      // 완료/건너뜀 처리된 건은 더 알리지 않는다
      if (item.status === "PAID" || item.status === "SKIPPED") continue;

      const due = new Date(
        Date.UTC(
          item.dueDate.getFullYear(),
          item.dueDate.getMonth(),
          item.dueDate.getDate(),
        ),
      );
      const daysLeft = Math.round(
        (due.getTime() - todayKst.getTime()) / 86_400_000,
      );

      const isIncome = item.rule.type === "INCOME";
      const amountText = `${formatWonShort(item.amount)}원${
        item.rule.isAmountVariable ? " (예상)" : ""
      }`;

      /*
       * 알림 단계 (가구 구성원 전원에게):
       *   전날(D-1)  : "내일 나갈/들어올 예정이에요"
       *   당일(D-0)  : "나갔는지/들어왔는지 확인하고 완료 처리해 주세요"
       *   다음날(D+1): 아직 완료 처리가 안 됐으면 한 번 더 — 확인해야
       *                다음 회차 관리가 이어진다
       *   그보다 일찍(notifyDaysBefore > 1): 예고 한 번 더
       * 같은 tag 라 최신 알림이 이전 것을 대체한다.
       */
      let title: string | null = null;
      let body: string | null = null;

      if (daysLeft === 1) {
        title = `내일 ${item.rule.name} 예정`;
        body = `${amountText}이 ${isIncome ? "들어올" : "나갈"} 예정이에요`;
      } else if (daysLeft === 0) {
        title = `오늘 ${item.rule.name} ${isIncome ? "들어오는" : "나가는"} 날`;
        body = `${amountText} — ${
          isIncome ? "들어왔는지" : "나갔는지"
        } 확인하고 완료 처리해 주세요`;
      } else if (daysLeft === -1) {
        title = `${item.rule.name} 확인이 필요해요`;
        body = `어제가 예정일이었어요. ${
          isIncome ? "들어왔다면" : "나갔다면"
        } 완료 처리해 주세요 (${amountText})`;
      } else if (
        item.rule.notifyDaysBefore > 1 &&
        daysLeft === item.rule.notifyDaysBefore
      ) {
        title = `${daysLeft}일 뒤 ${item.rule.name}`;
        body = `${amountText}이 ${isIncome ? "들어올" : "나갈"} 예정이에요`;
      }

      if (!title || !body) continue;

      const { sent } = await sendPushToHousehold(household.id, {
        title,
        body,
        url: "/fixed",
        tag: `fixed-${item.rule.id}`,
      });
      totalSent += sent;
    }

    // --- 신용카드 결제일: D-1 과 당일 ---
    const payments = await getUpcomingCardPayments(household.id);

    for (const payment of payments) {
      if (payment.total <= 0 || payment.statement?.isPaid) continue;
      if (payment.dday !== 0 && payment.dday !== 1) continue;

      const when = payment.dday === 0 ? "오늘" : "내일";

      const { sent } = await sendPushToHousehold(household.id, {
        title: `${when} ${payment.card.name} 결제일`,
        body: `${formatWonShort(payment.total)}원이 빠져나가요${
          payment.card.paymentAccount
            ? ` (${payment.card.paymentAccount.name})`
            : ""
        }`,
        url: "/cards",
        tag: `billing-${payment.card.id}`,
      });
      totalSent += sent;
    }
  }

  return NextResponse.json({
    ok: true,
    households: households.length,
    sent: totalSent,
  });
}
