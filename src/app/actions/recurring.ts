"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMembership } from "@/lib/auth";
import { getOccurrenceDate } from "@/lib/billing";
import { sendPushToHousehold } from "@/lib/push";
import { formatWonShort, toYearMonth } from "@/lib/utils";
import type { ActionState } from "./household";

const recurringSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1, "이름을 입력해 주세요.").max(40),
  kind: z.enum([
    "SALARY",
    "SIDE_INCOME",
    "CARD_BILL",
    "MAINTENANCE_FEE",
    "TELECOM",
    "UTILITY",
    "RENT",
    "LOAN_REPAYMENT",
    "INSURANCE",
    "SUBSCRIPTION",
    "SAVINGS",
    "EDUCATION",
    "MEMBERSHIP",
    "OTHER",
  ]),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
  amount: z.coerce.number().int().min(0),
  isAmountVariable: z.coerce.boolean().default(false),

  frequency: z
    .enum(["MONTHLY", "WEEKLY", "YEARLY", "BIMONTHLY", "QUARTERLY"])
    .default("MONTHLY"),
  dayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
  weekday: z.coerce.number().int().min(0).max(6).optional(),
  monthOfYear: z.coerce.number().int().min(1).max(12).optional(),
  dueDateShift: z
    .enum(["NONE", "PREV_BUSINESS_DAY", "NEXT_BUSINESS_DAY"])
    .default("NONE"),

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
  /** 누구 항목인지 (비우면 공용) */
  ownerMemberId: z.string().uuid().optional().or(z.literal("")),
  cardId: z.string().uuid().optional().or(z.literal("")),
  accountId: z.string().uuid().optional().or(z.literal("")),
  /** 이체(TRANSFER)일 때 받는 계좌 */
  toAccountId: z.string().uuid().optional().or(z.literal("")),
  categoryId: z.string().uuid().optional().or(z.literal("")),

  notifyDaysBefore: z.coerce.number().int().min(0).max(14).default(1),
  memo: z.string().trim().max(200).optional().or(z.literal("")),
});

function nullify(value: string | undefined) {
  return value && value.length > 0 ? value : null;
}

export async function createRecurringRule(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;

  const parsed = recurringSchema.safeParse({
    ...raw,
    isAmountVariable:
      raw.isAmountVariable === "on" || raw.isAmountVariable === "true",
    dayOfMonth: raw.dayOfMonth || undefined,
    weekday: raw.weekday || undefined,
    monthOfYear: raw.monthOfYear || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const data = parsed.data;
  await requireMembership(data.householdId, "MEMBER");

  await prisma.recurringRule.create({
    data: {
      householdId: data.householdId,
      name: data.name,
      kind: data.kind,
      type: data.type,
      amount: data.amount,
      isAmountVariable: data.isAmountVariable,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth ?? null,
      weekday: data.weekday ?? null,
      monthOfYear: data.monthOfYear ?? null,
      dueDateShift: data.dueDateShift,
      paymentMethod: data.paymentMethod,
      cardId: nullify(data.cardId),
      accountId: nullify(data.accountId),
      toAccountId: nullify(data.toAccountId),
      categoryId: nullify(data.categoryId),
      startDate: new Date(),
      notifyDaysBefore: data.notifyDaysBefore,
      memo: nullify(data.memo),
    },
  });

  revalidatePath("/", "layout");
  redirect("/fixed");
}

export async function toggleRecurringRule(ruleId: string, isActive: boolean) {
  const rule = await prisma.recurringRule.findUnique({ where: { id: ruleId } });
  if (!rule) return { error: "고정지출 항목을 찾을 수 없어요." };

  await requireMembership(rule.householdId, "MEMBER");

  await prisma.recurringRule.update({
    where: { id: ruleId },
    data: { isActive },
  });

  revalidatePath("/fixed");
  return { success: true };
}

export async function deleteRecurringRule(ruleId: string) {
  const rule = await prisma.recurringRule.findUnique({ where: { id: ruleId } });
  if (!rule) return { error: "고정지출 항목을 찾을 수 없어요." };

  await requireMembership(rule.householdId, "MEMBER");

  await prisma.recurringRule.delete({ where: { id: ruleId } });

  revalidatePath("/", "layout");
  return { success: true };
}

const markPaidSchema = z.object({
  ruleId: z.string().uuid(),
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  actualAmount: z.coerce.number().int().min(0),
});

/**
 * 고정지출 "납부 완료" 처리.
 * 실제 거래를 하나 만들고 이번 달 회차에 연결한다.
 */
export async function markOccurrencePaid(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = markPaidSchema.safeParse({
    ruleId: formData.get("ruleId"),
    yearMonth: formData.get("yearMonth"),
    actualAmount: formData.get("actualAmount"),
  });

  if (!parsed.success) {
    return { error: "금액을 확인해 주세요." };
  }

  const { ruleId, yearMonth, actualAmount } = parsed.data;

  const rule = await prisma.recurringRule.findUnique({ where: { id: ruleId } });
  if (!rule) return { error: "고정지출 항목을 찾을 수 없어요." };

  const { member } = await requireMembership(rule.householdId, "MEMBER");

  const dueDate =
    getOccurrenceDate({
      yearMonth,
      frequency: rule.frequency,
      dayOfMonth: rule.dayOfMonth,
      weekday: rule.weekday,
      monthOfYear: rule.monthOfYear,
      dueDateShift: rule.dueDateShift,
    }) ?? new Date();

  await prisma.$transaction(async (tx) => {
    const transaction = await tx.transaction.create({
      data: {
        householdId: rule.householdId,
        type: rule.type,
        amount: actualAmount,
        occurredAt: dueDate,
        merchant: rule.name,
        memo: rule.memo,
        categoryId: rule.categoryId,
        paymentMethod: rule.paymentMethod,
        cardId: rule.cardId,
        accountId: rule.accountId,
        toAccountId: rule.toAccountId,
        payerMemberId: member.id,
        createdByMemberId: member.id,
        recurringRuleId: rule.id,
      },
    });

    await tx.recurringOccurrence.upsert({
      where: { ruleId_yearMonth: { ruleId, yearMonth } },
      create: {
        ruleId,
        yearMonth,
        dueDate,
        expectedAmount: rule.amount,
        actualAmount,
        status: "PAID",
        paidAt: new Date(),
        transactionId: transaction.id,
      },
      update: {
        actualAmount,
        status: "PAID",
        paidAt: new Date(),
        transactionId: transaction.id,
      },
    });

    // 계좌에서 자동이체로 빠지는 항목이면 잔액 반영
    if (rule.accountId && rule.paymentMethod !== "CARD") {
      await tx.account.update({
        where: { id: rule.accountId },
        data:
          rule.type === "INCOME"
            ? { balance: { increment: actualAmount } }
            : { balance: { decrement: actualAmount } },
      });
    }

    /*
     * 이체는 받는 쪽도 함께 올린다. 총액은 그대로고 자리만 옮기는 것이라
     * 한쪽만 건드리면 자산이 사라진 것처럼 보인다.
     */
    if (rule.type === "TRANSFER" && rule.toAccountId) {
      await tx.account.update({
        where: { id: rule.toAccountId },
        data: { balance: { increment: actualAmount } },
      });
    }
  });

  // 완료 처리를 다른 구성원에게도 알린다 — 서로 확인돼야 다음 회차 관리가 이어진다
  try {
    await sendPushToHousehold(
      rule.householdId,
      {
        title: `${member.displayName ?? "구성원"}님이 ${rule.name} 완료 처리`,
        body: `${formatWonShort(actualAmount)}원 ${
          rule.type === "INCOME" ? "입금" : "납부"
        } 확인됐어요`,
        url: "/fixed",
        tag: `fixed-${rule.id}`,
      },
      member.userId,
    );
  } catch (error) {
    console.error("[push] 완료 처리 알림 실패", error);
  }

  revalidatePath("/", "layout");
  return { success: "처리했어요." };
}

/** 이번 달 건너뛰기 */
export async function skipOccurrence(ruleId: string, yearMonth: string) {
  const rule = await prisma.recurringRule.findUnique({ where: { id: ruleId } });
  if (!rule) return { error: "고정지출 항목을 찾을 수 없어요." };

  await requireMembership(rule.householdId, "MEMBER");

  const dueDate =
    getOccurrenceDate({
      yearMonth,
      frequency: rule.frequency,
      dayOfMonth: rule.dayOfMonth,
      weekday: rule.weekday,
      monthOfYear: rule.monthOfYear,
      dueDateShift: rule.dueDateShift,
    }) ?? new Date();

  await prisma.recurringOccurrence.upsert({
    where: { ruleId_yearMonth: { ruleId, yearMonth } },
    create: {
      ruleId,
      yearMonth,
      dueDate,
      expectedAmount: rule.amount,
      status: "SKIPPED",
    },
    update: { status: "SKIPPED" },
  });

  revalidatePath("/fixed");
  return { success: true };
}

/** 오늘 기준 이번 달 문자열 */
export async function currentYearMonth() {
  return toYearMonth(new Date());
}

/**
 * 고정 항목 수정.
 *
 * 지금까지는 만들고 지우는 것만 있어서, 월급 받는 통장이 바뀌거나 종류를
 * 잘못 고르면 지우고 다시 만들어야 했다. 그러면 그동안 확인 처리한
 * 이력(RecurringOccurrence)까지 함께 날아간다.
 */
export async function updateRecurringRule(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const ruleId = String(formData.get("ruleId") ?? "");
  if (!ruleId) return { error: "항목을 찾을 수 없어요." };

  // 생성과 같은 방식으로 읽는다 (체크박스·빈 문자열 처리 포함)
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = recurringSchema.safeParse({
    ...raw,
    isAmountVariable:
      raw.isAmountVariable === "on" || raw.isAmountVariable === "true",
    dayOfMonth: raw.dayOfMonth || undefined,
    weekday: raw.weekday || undefined,
    monthOfYear: raw.monthOfYear || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요.",
    };
  }

  const data = parsed.data;

  const rule = await prisma.recurringRule.findFirst({
    where: { id: ruleId, householdId: data.householdId },
    select: { id: true },
  });
  if (!rule) return { error: "항목을 찾을 수 없어요." };

  await requireMembership(data.householdId, "MEMBER");

  await prisma.recurringRule.update({
    where: { id: ruleId },
    data: {
      name: data.name,
      kind: data.kind,
      type: data.type,
      amount: data.amount,
      isAmountVariable: data.isAmountVariable,
      frequency: data.frequency,
      dayOfMonth: data.dayOfMonth ?? null,
      weekday: data.weekday ?? null,
      monthOfYear: data.monthOfYear ?? null,
      dueDateShift: data.dueDateShift,
      ownerMemberId: nullify(data.ownerMemberId),
      paymentMethod: data.paymentMethod,
      cardId: nullify(data.cardId),
      accountId: nullify(data.accountId),
      toAccountId: nullify(data.toAccountId),
      categoryId: nullify(data.categoryId),
      notifyDaysBefore: data.notifyDaysBefore,
      memo: nullify(data.memo),
    },
  });

  revalidatePath("/", "layout");
  redirect("/fixed");
}
