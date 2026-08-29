import { prisma } from "@/lib/prisma";
import {
  getOccurrenceDate,
  getStatementPeriod,
  getUpcomingStatementPeriod,
  type StatementPeriod,
} from "@/lib/billing";
import { RECURRING_KIND_META } from "@/lib/labels";
import {
  addMonths,
  dayOfMonthToDate,
  formatWonShort,
  fromYearMonth,
  toYearMonth,
} from "@/lib/utils";

/**
 * 가계부 한 달의 실제 시작/끝.
 * monthStartDay 가 25면 "2026-08" 은 7/25 00:00 ~ 8/24 23:59 를 뜻한다.
 */
export function getMonthRange(yearMonth: string, monthStartDay: number) {
  const [year, month] = yearMonth.split("-").map(Number);

  if (monthStartDay <= 1) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  }

  const start = dayOfMonthToDate(year, month - 1 || 12, monthStartDay);
  if (month === 1) start.setFullYear(year - 1);
  start.setHours(0, 0, 0, 0);

  const end = dayOfMonthToDate(year, month, monthStartDay);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

export type MonthlySummary = Awaited<ReturnType<typeof getMonthlySummary>>;

/** 한 달 수입/지출/남은돈. memberId 를 주면 그 사람이 결제한 것만 */
export async function getMonthlySummary(
  householdId: string,
  yearMonth: string,
  monthStartDay: number,
  memberId?: string | null,
  /** 카테고리로 걸러 볼 때 — 요약도 같이 걸러야 합계가 목록과 맞는다 */
  categoryId?: string | null,
) {
  const { start, end } = getMonthRange(yearMonth, monthStartDay);

  const grouped = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      householdId,
      occurredAt: { gte: start, lte: end },
      excludeFromStats: false,
      ...(memberId ? { payerMemberId: memberId } : {}),
      ...(categoryId === "none"
        ? { categoryId: null }
        : categoryId
          ? { categoryId }
          : {}),
    },
    _sum: { amount: true },
    _count: true,
  });

  const income =
    grouped.find((row) => row.type === "INCOME")?._sum.amount ?? 0;
  const expense =
    grouped.find((row) => row.type === "EXPENSE")?._sum.amount ?? 0;
  const count = grouped.reduce((sum, row) => sum + row._count, 0);

  return {
    yearMonth,
    start,
    end,
    income,
    expense,
    balance: income - expense,
    count,
  };
}

/** 카테고리별 지출 (많은 순). memberId 를 주면 그 사람이 결제한 것만 */
export async function getCategoryBreakdown(
  householdId: string,
  yearMonth: string,
  monthStartDay: number,
  memberId?: string | null,
) {
  const { start, end } = getMonthRange(yearMonth, monthStartDay);

  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      householdId,
      type: "EXPENSE",
      occurredAt: { gte: start, lte: end },
      excludeFromStats: false,
      ...(memberId ? { payerMemberId: memberId } : {}),
    },
    _sum: { amount: true },
  });

  const categories = await prisma.category.findMany({
    where: { householdId },
    select: { id: true, name: true, icon: true, color: true },
  });
  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const total = grouped.reduce((sum, row) => sum + (row._sum.amount ?? 0), 0);

  return grouped
    .map((row) => {
      const category = row.categoryId ? categoryMap.get(row.categoryId) : null;
      const amount = row._sum.amount ?? 0;

      return {
        categoryId: row.categoryId,
        name: category?.name ?? "미분류",
        icon: category?.icon ?? "❓",
        color: category?.color ?? "#9ca3af",
        amount,
        ratio: total > 0 ? amount / total : 0,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

export type CardBilling = Awaited<ReturnType<typeof getCardBillings>>[number];

/**
 * 카드별 이번 달 청구 예정액.
 * 일시불과 할부를 나눠서 보여준다 — "이번 달 25일에 얼마 나가는지"가 핵심.
 */
export async function getCardBillings(
  householdId: string,
  yearMonth: string,
  memberId?: string | null,
) {
  const cards = await prisma.card.findMany({
    where: {
      householdId,
      isActive: true,
      // 구성원 보기: 그 사람 소유 카드만
      ...(memberId ? { ownerMemberId: memberId } : {}),
    },
    include: {
      ownerMember: { select: { displayName: true, color: true } },
      paymentAccount: { select: { name: true, bankName: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const [year, month] = yearMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  /*
   * 신용카드는 결제일에 한꺼번에 청구되므로 InstallmentPlan 을 합산한다.
   * 체크/선불카드는 청구서가 없다 (긁는 즉시 계좌에서 빠지거나 충전액에서 빠진다).
   * 그래서 그 카드들은 대신 "그 달에 얼마 썼는지"를 보여준다.
   */
  const [plans, usage, statements] = await Promise.all([
    prisma.installmentPlan.findMany({
      where: {
        billingDate: { gte: monthStart, lte: monthEnd },
        transaction: { householdId },
      },
      include: {
        transaction: {
          select: {
            cardId: true,
            merchant: true,
            amount: true,
            occurredAt: true,
            installmentMonths: true,
          },
        },
      },
      orderBy: { billingDate: "asc" },
    }),
    prisma.transaction.groupBy({
      by: ["cardId"],
      where: {
        householdId,
        type: "EXPENSE",
        cardId: { not: null },
        occurredAt: { gte: monthStart, lte: monthEnd },
      },
      _sum: { amount: true },
    }),
    // 이 달 카드대금을 이미 냈는지
    prisma.cardStatement.findMany({
      where: { householdId, yearMonth },
    }),
  ]);

  const usageByCard = new Map(
    usage.map((row) => [row.cardId, row._sum.amount ?? 0]),
  );
  const statementByCard = new Map(
    statements.map((statement) => [statement.cardId, statement]),
  );

  return cards.map((card) => {
    const cardPlans = plans.filter((plan) => plan.transaction.cardId === card.id);

    const lumpSum = cardPlans
      .filter((plan) => plan.totalRounds === 1)
      .reduce((sum, plan) => sum + plan.amount, 0);

    const installment = cardPlans
      .filter((plan) => plan.totalRounds > 1)
      .reduce((sum, plan) => sum + plan.amount, 0);

    const period = getStatementPeriod(card, yearMonth);
    const isCredit = card.type === "CREDIT";

    return {
      card,
      period,
      /** 신용카드 여부. false 면 청구서 대신 monthlyUsage 를 보여준다 */
      isCredit,
      lumpSum,
      installment,
      total: lumpSum + installment,
      /** 그 달에 이 카드로 결제한 총액 (체크/선불카드 표시용) */
      monthlyUsage: usageByCard.get(card.id) ?? 0,
      /** 이 달 카드대금 납부 기록 (없으면 아직 안 낸 것) */
      statement: statementByCard.get(card.id) ?? null,
      /** 진행 중인 할부 (남은 회차 표시용) */
      ongoingInstallments: cardPlans
        .filter((plan) => plan.totalRounds > 1)
        .map((plan) => ({
          id: plan.id,
          merchant: plan.transaction.merchant ?? "할부 결제",
          round: plan.round,
          totalRounds: plan.totalRounds,
          amount: plan.amount,
          originalAmount: plan.transaction.amount,
        })),
    };
  });
}

/** 납부 되돌리기를 열어 두는 기간 — actions/statement.ts 와 같은 값 */
const UNDO_WINDOW_DAYS = 30;

export type CardStatementDetail = NonNullable<
  Awaited<ReturnType<typeof getCardStatementDetail>>
>;

/**
 * 신용카드 청구서 한 장.
 *
 * 달력 월이 아니라 "결제일 기준"으로 본다 — 8월 25일 결제분이면
 * 7/12~8/11 사용 내역이 담긴다. 실제 카드 명세서와 같은 단위다.
 * 회차를 일시불/할부로 나눠 돌려주므로 화면에서 탭으로 가를 수 있다.
 */
export async function getCardStatementDetail(
  householdId: string,
  cardId: string,
  yearMonth: string,
) {
  const card = await prisma.card.findFirst({
    where: { id: cardId, householdId },
    include: {
      ownerMember: { select: { displayName: true } },
      paymentAccount: { select: { id: true, name: true, bankName: true } },
    },
  });
  if (!card) return null;

  const period = getStatementPeriod(card, yearMonth);
  if (!period) return null;

  const [year, month] = yearMonth.split("-").map(Number);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const [plans, statement] = await Promise.all([
    prisma.installmentPlan.findMany({
      where: {
        billingDate: { gte: monthStart, lte: monthEnd },
        transaction: { cardId, householdId },
      },
      include: {
        transaction: {
          include: {
            category: { select: { name: true, icon: true, color: true } },
            card: {
              select: {
                name: true,
                issuer: true,
                color: true,
                last4: true,
                ownerMember: { select: { displayName: true } },
              },
            },
            account: {
              select: {
                name: true,
                bankName: true,
                ownerMember: { select: { displayName: true } },
              },
            },
            payer: { select: { displayName: true, color: true } },
          },
        },
      },
      orderBy: { transaction: { occurredAt: "desc" } },
    }),
    prisma.cardStatement.findUnique({
      where: { cardId_yearMonth: { cardId, yearMonth } },
    }),
  ]);

  const lumpSumItems = plans.filter((plan) => plan.totalRounds === 1);
  const installmentItems = plans.filter((plan) => plan.totalRounds > 1);

  const sum = (items: typeof plans) =>
    items.reduce((total, plan) => total + plan.amount, 0);

  /*
   * 되돌리기는 납부 후 UNDO_WINDOW_DAYS 까지만 (actions/statement.ts 와 같은 값).
   * 이 계산을 화면이 아니라 여기서 하는 이유: 컴포넌트 렌더 중 Date.now() 는
   * React 순수성 규칙에 걸린다.
   */
  const now = Date.now();
  const canUndo = statement?.paidAt
    ? Math.floor((now - statement.paidAt.getTime()) / 86_400_000) <=
      UNDO_WINDOW_DAYS
    : true;
  const isOverdue = !statement?.isPaid && period.billingDate.getTime() < now;

  /*
   * 이용기간이 아직 안 끝났으면 청구액이 확정되지 않는다 — 지금 납부
   * 처리해 버리면 그 뒤에 긁은 금액이 이 청구서에 계속 붙어 기록이 어긋난다.
   */
  const isPeriodOpen = period.periodEnd.getTime() > now;

  return {
    isPeriodOpen,
    card,
    period,
    statement,
    canUndo,
    isOverdue,
    all: plans,
    lumpSumItems,
    installmentItems,
    lumpSum: sum(lumpSumItems),
    installment: sum(installmentItems),
    total: sum(plans),
  };
}

/**
 * 청구서 선택기에 쓰는 목록.
 * 다음 결제 예정분부터 과거로 monthsBack 개월치.
 */
export async function getCardBillingOptions(
  householdId: string,
  cardId: string,
  monthsBack = 8,
  /*
   * 다음 결제일 이후 회차도 고른다. 이번 회차를 미리 납부했으면 그 다음을
   * 봐야 하는데, 과거만 담으면 갈 곳이 없다.
   */
  monthsAhead = 2,
) {
  const card = await prisma.card.findFirst({ where: { id: cardId, householdId } });

  const today = new Date();

  if (!card || card.type !== "CREDIT" || !card.billingDay) {
    return { options: [], defaultYearMonth: toYearMonth(today) };
  }

  const upcoming = getUpcomingStatementPeriod(card, today);
  const baseYearMonth = upcoming?.yearMonth ?? toYearMonth(today);

  // 최신 → 과거 순
  const yearMonths = [
    ...Array.from({ length: monthsAhead }, (_, index) =>
      addMonths(baseYearMonth, monthsAhead - index),
    ),
    ...Array.from({ length: monthsBack }, (_, index) =>
      addMonths(baseYearMonth, -index),
    ),
  ];

  // 전체 범위를 한 번에 읽고 월별로 나눈다
  const oldest = fromYearMonth(yearMonths[yearMonths.length - 1]);
  const newest = fromYearMonth(yearMonths[0]);

  const [plans, statements] = await Promise.all([
    prisma.installmentPlan.findMany({
      where: {
        billingDate: {
          gte: new Date(oldest.getFullYear(), oldest.getMonth(), 1),
          lte: new Date(newest.getFullYear(), newest.getMonth() + 1, 0, 23, 59, 59, 999),
        },
        transaction: { cardId, householdId },
      },
      select: { amount: true, billingDate: true },
    }),
    prisma.cardStatement.findMany({
      where: { cardId, yearMonth: { in: yearMonths } },
    }),
  ]);

  const options = yearMonths.map((yearMonth) => {
    const period = getStatementPeriod(card, yearMonth);
    const total = plans
      .filter((plan) => toYearMonth(plan.billingDate) === yearMonth)
      .reduce((sum, plan) => sum + plan.amount, 0);

    return {
      yearMonth,
      period,
      total,
      statement: statements.find((row) => row.yearMonth === yearMonth) ?? null,
    };
  });

  /*
   * 처음 열었을 때 보여줄 회차 — 카드 목록이 고르는 것과 같은 기준.
   * 연체분이 있으면 그것부터, 없으면 아직 안 낸 다음 회차.
   * (날짜 비교를 화면에서 하면 렌더 중 Date 접근이 되므로 여기서 정한다)
   */
  const ascending = [...options].reverse();

  const overdue = ascending.find(
    (option) =>
      option.period &&
      option.period.billingDate < today &&
      !option.statement?.isPaid &&
      option.total > 0,
  );

  const next = ascending.find(
    (option) =>
      option.period &&
      option.period.billingDate >= today &&
      !option.statement?.isPaid,
  );

  const defaultYearMonth =
    overdue?.yearMonth ?? next?.yearMonth ?? baseYearMonth;

  return { options, defaultYearMonth };
}

export type UpcomingCardPayment = Awaited<
  ReturnType<typeof getUpcomingCardPayments>
>[number];

/**
 * 카드별 "다음에 낼 카드값".
 *
 * 달을 골라서 보는 getCardBillings 와 달리, 오늘 기준으로 아직 오지 않은
 * 결제일을 카드마다 따로 계산한다. 결제일이 5일인 카드와 25일인 카드는
 * 같은 날에도 서로 다른 달의 청구서를 기다리고 있기 때문이다.
 */
export async function getUpcomingCardPayments(
  householdId: string,
  memberId?: string | null,
) {
  const cards = await prisma.card.findMany({
    where: {
      householdId,
      isActive: true,
      type: "CREDIT",
      billingDay: { not: null },
      ...(memberId ? { ownerMemberId: memberId } : {}),
    },
    include: {
      ownerMember: { select: { displayName: true } },
      paymentAccount: { select: { name: true, bankName: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /*
   * 카드마다 "지금 신경 써야 할 청구서" 하나를 고른다.
   *
   *   1) 결제일이 지났는데 아직 안 낸 게 있으면 그게 먼저다 (연체)
   *   2) 없으면 아직 오지 않은 결제일 중 안 낸 첫 회차
   *
   * 전에는 "오늘 이후 첫 결제일"만 봐서, 결제일이 하루만 지나도 미납분이
   * 화면에서 사라졌다. 8/25 를 안 낸 채 8/26 이 되면 9/25 만 보이는 식이라
   * 실제로 낸 8 월분을 9 월분에 체크하게 되는 사고가 났다.
   */
  const candidates = cards
    .map((card) => {
      const first = getUpcomingStatementPeriod(card, today);
      if (!first) return null;

      const base = fromYearMonth(first.yearMonth);
      const periods: StatementPeriod[] = [];

      // 과거 3회차 ~ 미래 2회차 (과거 → 미래 순)
      for (let offset = -3; offset <= 2; offset += 1) {
        const probe = new Date(base.getFullYear(), base.getMonth() + offset, 1);
        const period = getStatementPeriod(card, toYearMonth(probe));
        if (period) periods.push(period);
      }

      return periods.length > 0 ? { card, periods } : null;
    })
    .filter((item) => item !== null);

  if (candidates.length === 0) return [];

  // 후보 전체를 덮는 범위로 한 번만 조회한다
  const times = candidates.flatMap(({ periods }) =>
    periods.map((period) => period.billingDate.getTime()),
  );
  const earliest = new Date(Math.min(...times));
  const latest = new Date(Math.max(...times));

  const rangeStart = new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  const rangeEnd = new Date(
    latest.getFullYear(),
    latest.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );

  const [plans, statements] = await Promise.all([
    prisma.installmentPlan.findMany({
      where: {
        billingDate: { gte: rangeStart, lte: rangeEnd },
        transaction: { householdId },
      },
      include: {
        transaction: { select: { cardId: true, merchant: true } },
      },
      orderBy: { billingDate: "asc" },
    }),
    prisma.cardStatement.findMany({
      where: {
        householdId,
        yearMonth: {
          in: [
            ...new Set(
              candidates.flatMap(({ periods }) =>
                periods.map((period) => period.yearMonth),
              ),
            ),
          ],
        },
      },
    }),
  ]);

  return candidates.map(({ card, periods }) => {
    const rows = periods.map((period) => {
      // 그 카드의, 그 결제월에 청구되는 회차만 모은다
      const cardPlans = plans.filter(
        (plan) =>
          plan.transaction.cardId === card.id &&
          toYearMonth(plan.billingDate) === period.yearMonth,
      );

      const lumpSum = cardPlans
        .filter((plan) => plan.totalRounds === 1)
        .reduce((sum, plan) => sum + plan.amount, 0);
      const installment = cardPlans
        .filter((plan) => plan.totalRounds > 1)
        .reduce((sum, plan) => sum + plan.amount, 0);

      const statement =
        statements.find(
          (row) => row.cardId === card.id && row.yearMonth === period.yearMonth,
        ) ?? null;

      return {
        period,
        statement,
        lumpSum,
        installment,
        total: lumpSum + installment,
        isPaid: Boolean(statement?.isPaid),
      };
    });

    // 1) 연체 — 결제일이 지났는데 청구액이 있고 아직 안 냈다
    const overdue = rows.find(
      (row) => row.period.billingDate < today && !row.isPaid && row.total > 0,
    );

    // 2) 아직 오지 않은 결제일 중 안 낸 첫 회차
    const next = rows.find(
      (row) => row.period.billingDate >= today && !row.isPaid,
    );

    const picked = overdue ?? next ?? rows[rows.length - 1];
    const { period, statement, lumpSum, installment, total } = picked;

    return {
      card,
      period,
      lumpSum,
      installment,
      total,
      statement,
      canUndo: statement?.paidAt
        ? Math.floor((Date.now() - statement.paidAt.getTime()) / 86_400_000) <=
          UNDO_WINDOW_DAYS
        : true,
      isOverdue: Boolean(overdue),
      /** 이용기간이 아직 안 끝나 청구액이 더 늘 수 있는 상태 */
      isPeriodOpen: period.periodEnd.getTime() > Date.now(),
      /** 결제일까지 남은 날. 연체면 음수 */
      dday: Math.round(
        (new Date(
          period.billingDate.getFullYear(),
          period.billingDate.getMonth(),
          period.billingDate.getDate(),
        ).getTime() -
          today.getTime()) /
          86_400_000,
      ),
    };
  });
}

export type FixedScheduleItem = Awaited<
  ReturnType<typeof getFixedSchedule>
>[number];

/**
 * 이번 달 고정 수입/지출 일정.
 * 규칙(RecurringRule)에서 이번 달 예정일을 계산하고,
 * 이미 처리한 건(RecurringOccurrence)이 있으면 그 상태를 얹는다.
 */
export async function getFixedSchedule(
  householdId: string,
  yearMonth: string,
) {
  const rules = await prisma.recurringRule.findMany({
    where: { householdId, isActive: true },
    include: {
      card: {
        select: {
          name: true,
          issuer: true,
          color: true,
          last4: true,
          // 신용카드로 나가는 고정지출은 카드 청구서에 합쳐진다 (getUpcomingOutflows)
          type: true,
        },
      },
      account: { select: { name: true, bankName: true } },
      category: { select: { name: true, icon: true, color: true } },
      occurrences: { where: { yearMonth } },
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return rules
    .map((rule) => {
      const dueDate = getOccurrenceDate({
        yearMonth,
        frequency: rule.frequency,
        dayOfMonth: rule.dayOfMonth,
        weekday: rule.weekday,
        monthOfYear: rule.monthOfYear,
        dueDateShift: rule.dueDateShift,
      });

      if (!dueDate) return null; //  이번 달에는 발생하지 않는 주기

      const occurrence = rule.occurrences[0] ?? null;

      const status =
        occurrence?.status ??
        (dueDate < today ? ("OVERDUE" as const) : ("PENDING" as const));

      return {
        rule,
        dueDate,
        occurrence,
        status,
        amount: occurrence?.actualAmount ?? rule.amount,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

/** 거래 목록 (무한스크롤 없이 페이지 단위) */
export async function getTransactions(
  householdId: string,
  {
    yearMonth,
    monthStartDay,
    take = 100,
    skip = 0,
    type,
    cardId,
    accountId,
    categoryId,
    payerMemberId,
  }: {
    yearMonth?: string;
    monthStartDay: number;
    take?: number;
    skip?: number;
    type?: "INCOME" | "EXPENSE" | "TRANSFER";
    cardId?: string;
    /** 이 계좌가 관련된 내역 (출금·입금·이체 수신 포함) */
    accountId?: string;
    categoryId?: string;
    /** 구성원 보기: 이 사람이 결제한 것만 */
    payerMemberId?: string | null;
  },
) {
  const range = yearMonth ? getMonthRange(yearMonth, monthStartDay) : null;

  return prisma.transaction.findMany({
    where: {
      householdId,
      ...(range ? { occurredAt: { gte: range.start, lte: range.end } } : {}),
      ...(type ? { type } : {}),
      ...(cardId ? { cardId } : {}),
      ...(accountId
        ? { OR: [{ accountId }, { toAccountId: accountId }] }
        : {}),
      /*
       * "none" 은 카테고리를 안 정한 내역. 미분류가 많으면 예산 진행률이
       * 거짓말을 하니, 예산 화면에서 여기로 바로 걸러 보낼 수 있어야 한다.
       */
      ...(categoryId === "none"
        ? { categoryId: null }
        : categoryId
          ? { categoryId }
          : {}),
      ...(payerMemberId ? { payerMemberId } : {}),
    },
    include: {
      category: { select: { name: true, icon: true, color: true } },
      card: {
        select: {
          name: true,
          issuer: true,
          color: true,
          last4: true,
          // 구성원이 여럿이면 "누구 카드인지"가 이름만큼 중요하다
          ownerMember: { select: { displayName: true } },
        },
      },
      account: {
        select: {
          name: true,
          bankName: true,
          ownerMember: { select: { displayName: true } },
        },
      },
      payer: { select: { displayName: true, color: true } },
    },
    orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
    take,
    skip,
  });
}

/** 거래 등록 폼에서 쓰는 선택지 묶음 */
export async function getFormOptions(householdId: string) {
  const [categories, cards, accounts, members] = await Promise.all([
    prisma.category.findMany({
      where: { householdId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, type: true, icon: true, color: true },
    }),
    prisma.card.findMany({
      where: { householdId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        issuer: true,
        type: true,
        last4: true,
        color: true,
        billingDay: true,
        // 체크카드는 결제 즉시 이 계좌에서 빠진다
        paymentAccountId: true,
        ownerMember: { select: { displayName: true } },
      },
    }),
    prisma.account.findMany({
      where: { householdId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        bankName: true,
        type: true,
        balance: true,
        color: true,
        last4: true,
        // 수정 권한 판단에 필요 (canManageAsset)
        ownerMemberId: true,
        createdByMemberId: true,
        ownerMember: { select: { displayName: true } },
      },
    }),
    prisma.householdMember.findMany({
      where: { householdId },
      orderBy: { joinedAt: "asc" },
      select: {
        id: true,
        displayName: true,
        color: true,
        role: true,
        user: { select: { nickname: true, avatarUrl: true } },
      },
    }),
  ]);

  return { categories, cards, accounts, members };
}

/** 총 자산 (계좌 잔액 합). memberId 를 주면 그 사람 소유 계좌만 */
export async function getTotalAssets(
  householdId: string,
  memberId?: string | null,
) {
  const result = await prisma.account.aggregate({
    where: {
      householdId,
      isActive: true,
      ...(memberId ? { ownerMemberId: memberId } : {}),
    },
    _sum: { balance: true },
  });

  return result._sum.balance ?? 0;
}

/**
 * 자산을 종류별로 나눈 요약.
 *
 * "총 자산" 한 줄만 보면 현금인지 통장인지 알 수 없다.
 * 현금(지갑)·입출금·예적금·투자를 나누고, 대출은 갚을 돈으로 따로 센다.
 */
export async function getAssetSummary(
  householdId: string,
  memberId?: string | null,
) {
  const grouped = await prisma.account.groupBy({
    by: ["type"],
    where: {
      householdId,
      isActive: true,
      ...(memberId ? { ownerMemberId: memberId } : {}),
    },
    _sum: { balance: true },
  });

  const amountOf = (type: string) =>
    grouped.find((row) => row.type === type)?._sum.balance ?? 0;

  const cash = amountOf("CASH");
  const checking = amountOf("CHECKING");
  const savings = amountOf("SAVINGS");
  const investment = amountOf("INVESTMENT");
  const other = amountOf("OTHER");
  // 대출은 음수로 저장돼 있다 — 갚을 돈으로 볼 땐 양수로 뒤집는다
  const loan = amountOf("LOAN");

  return {
    cash,
    checking,
    savings,
    investment,
    other,
    /** 갚아야 할 대출 (양수) */
    loanDebt: Math.abs(Math.min(0, loan)),
    /** 현금 + 통장 + 예적금 + 투자 + 기타 (대출 제외) */
    total: cash + checking + savings + investment + other,
  };
}

/** 헤더 구성원 선택기에 쓰는 가벼운 구성원 목록 */
export async function getHouseholdMembers(householdId: string) {
  const members = await prisma.householdMember.findMany({
    where: { householdId },
    orderBy: { joinedAt: "asc" },
    select: {
      id: true,
      displayName: true,
      color: true,
      user: { select: { nickname: true } },
    },
  });

  return members.map((member) => ({
    id: member.id,
    displayName: member.displayName,
    color: member.color,
    nickname: member.user.nickname,
  }));
}

/** 다가오는 고정지출 (오늘 이후 7일 이내) — 홈 화면 알림용 */
export async function getUpcomingFixed(householdId: string, days = 7) {
  const yearMonth = toYearMonth(new Date());
  const schedule = await getFixedSchedule(householdId, yearMonth);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);

  const thisMonth = schedule.filter(
    (item) =>
      item.status !== "PAID" &&
      item.status !== "SKIPPED" &&
      item.dueDate >= today &&
      item.dueDate <= limit,
  );

  // 달을 넘어가는 구간(예: 말일에 다음 달 초 일정)도 함께 본다
  if (limit.getMonth() !== today.getMonth()) {
    const nextMonth = toYearMonth(limit);
    const nextSchedule = await getFixedSchedule(householdId, nextMonth);

    thisMonth.push(
      ...nextSchedule.filter(
        (item) =>
          item.status !== "PAID" &&
          item.status !== "SKIPPED" &&
          item.dueDate >= today &&
          item.dueDate <= limit,
      ),
    );
  }

  return thisMonth.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
}

// ---------------------------------------------------------------------------
// 예산 / 저축 목표
// ---------------------------------------------------------------------------

export type BudgetOverview = Awaited<ReturnType<typeof getBudgetOverview>>;

/**
 * 이번 달 예산 현황.
 *
 * Budget 은 달마다 행이 따로라, 그대로 두면 새 달이 될 때마다 예산이
 * 사라진 것처럼 보인다. 매달 다시 짜게 하면 아무도 안 쓰므로,
 * 이번 달 행이 없으면 가장 최근 달 값을 그대로 이어받아 보여준다.
 * (수정할 때 비로소 이번 달 행이 생긴다 — actions/budget.ts)
 */
export async function getBudgetOverview(
  householdId: string,
  yearMonth: string,
  monthStartDay: number,
  memberId?: string | null,
) {
  const [rows, breakdown, categories] = await Promise.all([
    // 이번 달 것과, 없을 때 물려받을 이전 달들을 한 번에 가져온다
    prisma.budget.findMany({
      where: { householdId, yearMonth: { lte: yearMonth } },
      orderBy: { yearMonth: "desc" },
    }),
    getCategoryBreakdown(householdId, yearMonth, monthStartDay, memberId),
    prisma.category.findMany({
      where: { householdId, type: "EXPENSE", isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, icon: true, color: true },
    }),
  ]);

  const thisMonth = rows.filter((row) => row.yearMonth === yearMonth);
  const isInherited = thisMonth.length === 0;

  /** 이번 달 값이 없으면 가장 최근에 정해둔 값 */
  function budgetFor(categoryId: string | null) {
    const own = thisMonth.find((row) => row.categoryId === categoryId);
    if (own) return own.amount;
    if (!isInherited) return null;
    return rows.find((row) => row.categoryId === categoryId)?.amount ?? null;
  }

  const spentByCategory = new Map(
    breakdown.map((row) => [row.categoryId, row]),
  );

  const items = categories
    .map((category) => {
      const limit = budgetFor(category.id);
      const spent = spentByCategory.get(category.id)?.amount ?? 0;

      return {
        categoryId: category.id,
        name: category.name,
        icon: category.icon ?? "📌",
        color: category.color,
        limit,
        spent,
        remaining: limit === null ? null : limit - spent,
        ratio: limit && limit > 0 ? spent / limit : null,
      };
    })
    // 한도를 정한 것 먼저, 그 다음 많이 쓴 순
    .sort((a, b) => {
      if ((a.limit === null) !== (b.limit === null)) return a.limit ? -1 : 1;
      return b.spent - a.spent;
    });

  const monthlyLimit = budgetFor(null);
  const totalSpent = breakdown.reduce((sum, row) => sum + row.amount, 0);

  // 카테고리 한도의 합 — 월 한도 안에서 얼마나 배정했는지 보여준다
  const assigned = items.reduce((sum, item) => sum + (item.limit ?? 0), 0);

  const uncategorized = breakdown.find((row) => row.categoryId === null);

  return {
    yearMonth,
    isInherited,
    monthlyLimit,
    totalSpent,
    assigned,
    items,
    /** 예산에 잡히지 않는 돈 — 이게 크면 진행률이 거짓말을 한다 */
    uncategorized: uncategorized
      ? { amount: uncategorized.amount, ratio: uncategorized.ratio }
      : null,
    /** 한도를 하나라도 정했는지 */
    hasAnyBudget: monthlyLimit !== null || items.some((i) => i.limit !== null),
  };
}

/**
 * 이번 달이 얼마나 지났는지.
 * "오늘까지 이 정도면 적정" 을 계산해 페이스를 알려주는 데 쓴다.
 */
export function getMonthProgress(
  yearMonth: string,
  monthStartDay: number,
  today = new Date(),
) {
  const { start, end } = getMonthRange(yearMonth, monthStartDay);

  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = today.getTime() - start.getTime();

  // 지난 달을 보고 있으면 100%, 다음 달이면 0%
  const ratio = Math.min(1, Math.max(0, elapsedMs / totalMs));

  return {
    start,
    end,
    ratio,
    daysTotal: Math.round(totalMs / 86_400_000) + 1,
    daysLeft: Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86_400_000)),
    isCurrent: today >= start && today <= end,
  };
}

/** 저축 목표 — 모인 금액은 연결한 계좌 잔액에서 읽는다 */
export async function getSavingsGoals(householdId: string) {
  const goals = await prisma.savingsGoal.findMany({
    where: { householdId },
    include: {
      account: { select: { id: true, name: true, bankName: true, balance: true } },
    },
    orderBy: [{ isAchieved: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return goals.map((goal) => {
    const saved = goal.startAmount + (goal.account?.balance ?? 0);
    const ratio = goal.targetAmount > 0 ? saved / goal.targetAmount : 0;

    return {
      ...goal,
      saved,
      remaining: Math.max(0, goal.targetAmount - saved),
      ratio: Math.min(1, Math.max(0, ratio)),
    };
  });
}

// ---------------------------------------------------------------------------
// 홈
// ---------------------------------------------------------------------------

export type Outflow = Awaited<
  ReturnType<typeof getCashflowHorizon>
>["outflows"][number];

/**
 * 앞으로 한 달, 통장에서 나갈 돈과 들어올 돈.
 *
 * 예전엔 홈에 "다가오는 일정" 과 "다가오는 카드 결제" 가 따로 있었다.
 * 둘 다 "이번에 얼마가 빠져나가나" 라는 같은 질문에 답하는데 나뉘어 있어
 * 총액을 알려면 눈으로 더해야 했다.
 *
 * 이중 계산을 두 군데서 막는다.
 *  - 신용카드로 결제되는 고정지출(관리비 등)은 카드 청구서에 이미 들어 있다.
 *    체크카드는 즉시 출금이라 청구서가 없으니 그대로 센다.
 *  - "카드대금" 종류의 규칙도 카드 쪽에서 이미 세고 있다.
 *
 * 지난 날짜라도 아직 안 낸 것이면 그대로 남긴다.
 */
export async function getCashflowHorizon(
  householdId: string,
  memberId?: string | null,
  days = 31,
) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const limit = new Date(today);
  limit.setDate(limit.getDate() + days);

  const yearMonth = toYearMonth(today);

  const [thisSchedule, nextSchedule, cards] = await Promise.all([
    getFixedSchedule(householdId, yearMonth),
    // 말일 근처에서는 다음 달 초 일정도 곧 나갈 돈이다
    getFixedSchedule(householdId, addMonths(yearMonth, 1)),
    getUpcomingCardPayments(householdId, memberId),
  ]);

  const dday = (date: Date) =>
    Math.round(
      (new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
      ).getTime() -
        today.getTime()) /
        86_400_000,
    );

  const pending = [...thisSchedule, ...nextSchedule].filter(
    (item) =>
      item.status !== "PAID" &&
      item.status !== "SKIPPED" &&
      item.dueDate <= limit,
  );

  const fixed = pending
    .filter(
      (item) =>
        item.rule.type === "EXPENSE" &&
        item.rule.kind !== "CARD_BILL" &&
        item.rule.card?.type !== "CREDIT",
    )
    .map((item) => {
      const meta = RECURRING_KIND_META[item.rule.kind];

      return {
        key: `fixed-${item.rule.id}-${item.dueDate.toISOString()}`,
        kind: "FIXED" as const,
        name: item.rule.name,
        note: item.rule.isAmountVariable ? "금액 변동" : meta.label,
        amount: item.amount,
        date: item.dueDate,
        dday: dday(item.dueDate),
        isOverdue: dday(item.dueDate) < 0,
        emoji: meta.emoji,
        color: meta.color,
        href: "/fixed" as const,
      };
    });

  const cardOutflows = cards
    .filter((item) => item.total > 0 && !item.statement?.isPaid)
    .map((item) => ({
      key: `card-${item.card.id}`,
      kind: "CARD" as const,
      name: item.card.ownerMember?.displayName
        ? `${item.card.ownerMember.displayName} · ${item.card.name}`
        : item.card.name,
      note:
        item.installment > 0
          ? `할부 ${formatWonShort(item.installment)} 포함`
          : `${item.period.periodStart.getMonth() + 1}/${item.period.periodStart.getDate()}~${item.period.periodEnd.getMonth() + 1}/${item.period.periodEnd.getDate()} 사용분`,
      amount: item.total,
      date: item.period.billingDate,
      dday: item.dday,
      isOverdue: item.isOverdue,
      emoji: "💳",
      color: item.card.color,
      href: `/cards/${item.card.id}` as const,
    }));

  const outflows = [...fixed, ...cardOutflows].sort(
    (a, b) => a.date.getTime() - b.date.getTime(),
  );

  // 들어올 돈 — 이게 빠지면 월급 전날의 잔액이 늘 모자란 것처럼 보인다
  const inflows = pending
    .filter((item) => item.rule.type === "INCOME")
    .map((item) => ({
      name: item.rule.name,
      amount: item.amount,
      date: item.dueDate,
      dday: dday(item.dueDate),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  return {
    outflows,
    inflows,
    outTotal: outflows.reduce((sum, item) => sum + item.amount, 0),
    inTotal: inflows.reduce((sum, item) => sum + item.amount, 0),
    /** 신용카드로 나가서 카드 청구서에 합쳐진 고정지출 (안내용) */
    mergedIntoCard: pending
      .filter(
        (item) =>
          item.rule.type === "EXPENSE" && item.rule.card?.type === "CREDIT",
      )
      .reduce((sum, item) => sum + item.amount, 0),
  };
}

/**
 * 홈 맨 위의 큰 숫자.
 *
 * 예산을 정했으면 "이번 달 더 쓸 수 있는 돈" — 남은 고정지출까지 빼야
 * 진짜 재량껏 쓸 수 있는 돈이 된다. 안 그러면 월말에 관리비가 아직
 * 안 빠진 상태에서 "여유 있네" 로 보인다.
 *
 * 예산이 없으면 "다 내고 남는 돈" — 가진 돈에서 곧 나갈 돈을 뺀 값.
 */
export async function getHomeHero(
  householdId: string,
  yearMonth: string,
  monthStartDay: number,
  memberId?: string | null,
) {
  const [budget, assets, horizon, summary] = await Promise.all([
    getBudgetOverview(householdId, yearMonth, monthStartDay, memberId),
    getAssetSummary(householdId, memberId),
    getCashflowHorizon(householdId, memberId),
    getMonthlySummary(householdId, yearMonth, monthStartDay, memberId),
  ]);

  const dueTotal = horizon.outTotal;
  const comingTotal = horizon.inTotal;

  /*
   * 예산에서 뺄 고정지출은 "이번 달 안에 아직 안 나간 것"만이다.
   * 다음 달 몫까지 빼면 이번 달 여유가 실제보다 작게 나온다.
   */
  const monthEnd = getMonthRange(yearMonth, monthStartDay).end;
  const fixedLeft = horizon.outflows
    .filter((item) => item.kind === "FIXED" && item.date <= monthEnd)
    .reduce((sum, item) => sum + item.amount, 0);

  const progress = getMonthProgress(yearMonth, monthStartDay);

  if (budget.monthlyLimit !== null) {
    const limit = budget.monthlyLimit;
    const spendable = limit - budget.totalSpent - fixedLeft;
    const pace = Math.round(limit * progress.ratio);

    return {
      mode: "BUDGET" as const,
      amount: spendable,
      limit,
      spent: budget.totalSpent,
      fixedLeft,
      /** 오늘까지 이 정도면 적정 */
      pace,
      /** 양수면 아끼는 중 */
      paceDiff: pace - budget.totalSpent,
      daysLeft: progress.daysLeft,
      isCurrentMonth: progress.isCurrent,
      assets,
      dueTotal,
      comingTotal,
      summary,
    };
  }

  return {
    mode: "CASHFLOW" as const,
    // 들어올 월급을 빼먹으면 월급 전날마다 "모자람" 으로 보인다
    amount: assets.total + comingTotal - dueTotal,
    limit: null,
    spent: budget.totalSpent,
    fixedLeft,
    pace: null,
    paceDiff: null,
    daysLeft: progress.daysLeft,
    isCurrentMonth: progress.isCurrent,
    assets,
    dueTotal,
    comingTotal,
    summary,
  };
}
