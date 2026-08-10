/**
 * 카드 청구 주기 / 할부 / 고정지출 예정일 계산.
 *
 * 한국 신용카드는 보통 이런 식이다.
 *   결제일 25일, 이용기간 전월 12일 ~ 당월 11일
 * 이걸 Card.billingDay / statementStartDay / statementEndDay 로 표현한다.
 */
import { dayOfMonthToDate, shiftToBusinessDay, toYearMonth } from "@/lib/utils";
import type { DueDateShift, Frequency } from "@/generated/prisma/enums";

export type BillingCardConfig = {
  billingDay: number | null;
  statementStartDay: number | null;
  statementEndDay: number | null;
};

export type StatementPeriod = {
  yearMonth: string;
  /** 실제 카드값이 빠져나가는 날 */
  billingDate: Date;
  periodStart: Date;
  periodEnd: Date;
};

/**
 * "2026-08" 청구서의 결제일과 이용기간을 구한다.
 * 이용기간 종료일이 결제일보다 뒤면(예: 결제일 1일, 종료일 말일) 한 달 앞의 기간을 쓴다.
 */
export function getStatementPeriod(
  card: BillingCardConfig,
  yearMonth: string,
): StatementPeriod | null {
  if (!card.billingDay) return null;

  const [year, month] = yearMonth.split("-").map(Number);

  const billingDate = dayOfMonthToDate(year, month, card.billingDay);

  const startDay = card.statementStartDay ?? 1;
  const endDay = card.statementEndDay ?? 31;

  // 이용기간 종료 -> 결제일과 같은 달이거나 그 전달
  let endMonthOffset = 0;
  if (endDay > card.billingDay) endMonthOffset = -1;

  const endBase = new Date(year, month - 1 + endMonthOffset, 1);
  const periodEnd = dayOfMonthToDate(
    endBase.getFullYear(),
    endBase.getMonth() + 1,
    endDay,
  );
  periodEnd.setHours(23, 59, 59, 999);

  // 시작일이 종료일보다 큰 숫자면(12일 시작 ~ 11일 종료) 전달부터 시작
  const startMonthOffset = startDay > endDay ? -1 : 0;
  const startBase = new Date(
    periodEnd.getFullYear(),
    periodEnd.getMonth() + startMonthOffset,
    1,
  );
  const periodStart = dayOfMonthToDate(
    startBase.getFullYear(),
    startBase.getMonth() + 1,
    startDay,
  );
  periodStart.setHours(0, 0, 0, 0);

  return { yearMonth, billingDate, periodStart, periodEnd };
}

/**
 * 이 날짜에 긁은 카드 결제가 "몇 월 청구서"에 잡히는지 찾는다.
 * 구매일 기준 당월/익월/익익월 청구서를 순서대로 확인한다.
 */
export function findStatementForPurchase(
  card: BillingCardConfig,
  purchaseDate: Date,
): StatementPeriod | null {
  if (!card.billingDay) return null;

  for (let offset = 0; offset <= 2; offset++) {
    const probe = new Date(
      purchaseDate.getFullYear(),
      purchaseDate.getMonth() + offset,
      1,
    );
    const period = getStatementPeriod(card, toYearMonth(probe));
    if (!period) continue;

    if (purchaseDate >= period.periodStart && purchaseDate <= period.periodEnd) {
      return period;
    }
  }
  return null;
}

export type InstallmentRound = {
  round: number;
  totalRounds: number;
  amount: number;
  interest: number;
  billingDate: Date;
  yearMonth: string;
};

/**
 * 할부 회차별 청구 스케줄을 만든다.
 *
 * - months <= 1 이면 일시불이므로 1회차만 생성
 * - 나누어떨어지지 않는 금액은 1회차에 몰아준다 (카드사 관행)
 * - 유이자면 interestAmount 를 회차 수로 나눠 붙인다
 */
export function buildInstallmentSchedule({
  amount,
  months,
  purchaseDate,
  card,
  interestAmount = 0,
}: {
  amount: number;
  months: number;
  purchaseDate: Date;
  card: BillingCardConfig;
  interestAmount?: number;
}): InstallmentRound[] {
  const totalRounds = Math.max(1, Math.floor(months));

  const firstStatement = findStatementForPurchase(card, purchaseDate);
  // 결제일 정보가 없는 카드(체크카드 등)는 결제일 = 사용일로 본다.
  const firstBillingDate = firstStatement?.billingDate ?? new Date(purchaseDate);

  const basePrincipal = Math.floor(amount / totalRounds);
  const principalRemainder = amount - basePrincipal * totalRounds;

  const baseInterest = Math.floor(interestAmount / totalRounds);
  const interestRemainder = interestAmount - baseInterest * totalRounds;

  return Array.from({ length: totalRounds }, (_, index) => {
    const round = index + 1;

    const principal =
      round === 1 ? basePrincipal + principalRemainder : basePrincipal;
    const interest =
      round === 1 ? baseInterest + interestRemainder : baseInterest;

    const billingDate = new Date(
      firstBillingDate.getFullYear(),
      firstBillingDate.getMonth() + index,
      1,
    );
    // 결제일이 31일인데 다음 달이 30일까지면 말일로 보정
    const day = card.billingDay ?? firstBillingDate.getDate();
    const adjusted = dayOfMonthToDate(
      billingDate.getFullYear(),
      billingDate.getMonth() + 1,
      day,
    );

    return {
      round,
      totalRounds,
      amount: principal + interest,
      interest,
      billingDate: adjusted,
      yearMonth: toYearMonth(adjusted),
    };
  });
}

/**
 * 반복 규칙의 특정 연월 예정일.
 * 예) 매월 25일 / 매년 3월 / 매주 금요일
 */
export function getOccurrenceDate({
  yearMonth,
  frequency,
  dayOfMonth,
  weekday,
  monthOfYear,
  dueDateShift = "NONE",
}: {
  yearMonth: string;
  frequency: Frequency;
  dayOfMonth?: number | null;
  weekday?: number | null;
  monthOfYear?: number | null;
  dueDateShift?: DueDateShift;
}): Date | null {
  const [year, month] = yearMonth.split("-").map(Number);

  let date: Date | null = null;

  switch (frequency) {
    case "MONTHLY":
      date = dayOfMonthToDate(year, month, dayOfMonth ?? 1);
      break;

    case "BIMONTHLY":
    case "QUARTERLY": {
      // 시작월 기준으로 주기가 맞는 달에만 발생
      const step = frequency === "BIMONTHLY" ? 2 : 3;
      const anchor = (monthOfYear ?? 1) - 1;
      if ((month - 1 - anchor) % step !== 0) return null;
      date = dayOfMonthToDate(year, month, dayOfMonth ?? 1);
      break;
    }

    case "YEARLY":
      if (monthOfYear && monthOfYear !== month) return null;
      date = dayOfMonthToDate(year, month, dayOfMonth ?? 1);
      break;

    case "WEEKLY": {
      // 그 달의 첫 해당 요일 (주간 항목은 목록에서 대표 1건만 보여준다)
      const first = new Date(year, month - 1, 1);
      const diff = ((weekday ?? 1) - first.getDay() + 7) % 7;
      date = new Date(year, month - 1, 1 + diff);
      break;
    }
  }

  if (!date) return null;

  const direction =
    dueDateShift === "PREV_BUSINESS_DAY"
      ? "prev"
      : dueDateShift === "NEXT_BUSINESS_DAY"
        ? "next"
        : "none";

  return shiftToBusinessDay(date, direction);
}
