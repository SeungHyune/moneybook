import { prisma } from "@/lib/prisma";
import {
  getOccurrenceDate,
  getStatementPeriod,
  getUpcomingStatementPeriod,
  type StatementPeriod,
} from "@/lib/billing";
import { dayOfMonthToDate, toYearMonth } from "@/lib/utils";

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
) {
  const { start, end } = getMonthRange(yearMonth, monthStartDay);

  const grouped = await prisma.transaction.groupBy({
    by: ["type"],
    where: {
      householdId,
      occurredAt: { gte: start, lte: end },
      excludeFromStats: false,
      ...(memberId ? { payerMemberId: memberId } : {}),
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

  const targets = cards
    .map((card) => ({
      card,
      period: getUpcomingStatementPeriod(card, today),
    }))
    .filter(
      (item): item is { card: (typeof cards)[number]; period: StatementPeriod } =>
        item.period !== null,
    );

  if (targets.length === 0) return [];

  // 카드마다 결제 달이 다를 수 있으니, 전체를 덮는 범위로 한 번만 조회한다
  const times = targets.map((item) => item.period.billingDate.getTime());
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
        yearMonth: { in: targets.map((item) => item.period.yearMonth) },
      },
    }),
  ]);

  return targets.map(({ card, period }) => {
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
      card,
      period,
      lumpSum,
      installment,
      total: lumpSum + installment,
      statement,
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
      card: { select: { name: true, issuer: true, color: true, last4: true } },
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
      ...(categoryId ? { categoryId } : {}),
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
