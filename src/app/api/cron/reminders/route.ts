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

      const notifyBefore = item.rule.notifyDaysBefore;
      if (daysLeft !== 0 && daysLeft !== notifyBefore) continue;
      if (daysLeft < 0) continue;

      const when = daysLeft === 0 ? "오늘" : `${daysLeft}일 뒤`;
      const verb = item.rule.type === "INCOME" ? "들어와요" : "나가요";

      const { sent } = await sendPushToHousehold(household.id, {
        title: `${when} ${item.rule.name}`,
        body: `${formatWonShort(item.amount)}원이 ${verb}${
          item.rule.isAmountVariable ? " (예상 금액)" : ""
        }`,
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
