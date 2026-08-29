"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHouseholdContext } from "@/lib/auth";
import type { ActionState } from "./household";

/**
 * 예산 저장.
 *
 * Budget 은 (가구, 연월, 카테고리) 한 행이다. categoryId 가 없으면 월 전체 한도.
 * 이번 달 행이 없으면 화면은 지난달 값을 물려받아 보여주는데(getBudgetOverview),
 * 여기서 저장하는 순간 이번 달 행이 생기면서 그 달만의 값으로 굳는다.
 *
 * 0 원은 "한도 없음"으로 보고 행을 지운다 — 0 원 한도는 뜻이 애매하고,
 * 화면에서 바로 초과로 뜨기만 한다.
 */

const schema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  /** 비우면 월 전체 예산 */
  categoryId: z.string().uuid().optional().or(z.literal("")),
  amount: z.coerce.number().int().min(0).max(1_000_000_000),
});

export async function saveBudget(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = schema.safeParse({
    yearMonth: formData.get("yearMonth"),
    categoryId: formData.get("categoryId") ?? "",
    amount: formData.get("amount") ?? 0,
  });

  if (!parsed.success) return { error: "금액을 확인해 주세요." };

  const { household } = await requireHouseholdContext();
  const { yearMonth, amount } = parsed.data;
  const categoryId = parsed.data.categoryId || null;

  // 남의 가구 카테고리에 예산을 걸지 못하게 확인
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, householdId: household.id },
      select: { id: true },
    });
    if (!category) return { error: "카테고리를 찾을 수 없어요." };
  }

  if (amount === 0) {
    await prisma.budget.deleteMany({
      where: { householdId: household.id, yearMonth, categoryId },
    });
  } else {
    /*
     * upsert 를 못 쓴다. 유니크 키에 categoryId 가 들어 있는데 월 전체
     * 예산은 그 값이 NULL 이고, Postgres 에서 NULL 은 서로 같지 않아
     * 유니크가 걸리지 않는다. (DB 쪽은 부분 인덱스로 따로 막아 뒀다.)
     */
    const existing = await prisma.budget.findFirst({
      where: { householdId: household.id, yearMonth, categoryId },
      select: { id: true },
    });

    if (existing) {
      await prisma.budget.update({ where: { id: existing.id }, data: { amount } });
    } else {
      await prisma.budget.create({
        data: { householdId: household.id, yearMonth, categoryId, amount },
      });
    }
  }

  revalidatePath("/", "layout");
  return { success: "예산을 저장했어요." };
}

/**
 * 물려받은 예산을 이번 달 것으로 확정한다.
 *
 * 지난달 값을 그대로 쓰는 동안에는 이번 달 행이 없어서, 지난달 예산을
 * 고치면 이번 달까지 따라 바뀐다. "이번 달만 다르게" 하려면 먼저 굳혀야 한다.
 */
export async function materializeBudget(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const yearMonth = String(formData.get("yearMonth") ?? "");
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return { error: "월 정보가 잘못됐어요." };
  }

  const { household } = await requireHouseholdContext();

  const existing = await prisma.budget.count({
    where: { householdId: household.id, yearMonth },
  });
  if (existing > 0) return { success: "이미 이번 달 예산이에요." };

  // 가장 최근에 정해둔 달을 통째로 복사한다
  const latest = await prisma.budget.findFirst({
    where: { householdId: household.id, yearMonth: { lt: yearMonth } },
    orderBy: { yearMonth: "desc" },
    select: { yearMonth: true },
  });
  if (!latest) return { error: "가져올 예산이 없어요." };

  const source = await prisma.budget.findMany({
    where: { householdId: household.id, yearMonth: latest.yearMonth },
  });

  await prisma.budget.createMany({
    data: source.map((row) => ({
      householdId: household.id,
      yearMonth,
      categoryId: row.categoryId,
      amount: row.amount,
    })),
  });

  revalidatePath("/", "layout");
  return { success: "이번 달 예산으로 가져왔어요." };
}

// ---------------------------------------------------------------------------
// 저축 목표
// ---------------------------------------------------------------------------

const goalSchema = z.object({
  id: z.string().uuid().optional().or(z.literal("")),
  name: z.string().trim().min(1).max(40),
  targetAmount: z.coerce.number().int().positive().max(10_000_000_000),
  targetDate: z.string().optional().or(z.literal("")),
  accountId: z.string().uuid().optional().or(z.literal("")),
  startAmount: z.coerce.number().int().min(0).default(0),
});

export async function saveSavingsGoal(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = goalSchema.safeParse({
    id: formData.get("id") ?? "",
    name: formData.get("name"),
    targetAmount: formData.get("targetAmount"),
    targetDate: formData.get("targetDate") ?? "",
    accountId: formData.get("accountId") ?? "",
    startAmount: formData.get("startAmount") || 0,
  });

  if (!parsed.success) return { error: "목표 정보를 확인해 주세요." };

  const { household } = await requireHouseholdContext();
  const { name, targetAmount, startAmount } = parsed.data;
  const accountId = parsed.data.accountId || null;
  const targetDate = parsed.data.targetDate
    ? new Date(parsed.data.targetDate)
    : null;

  if (accountId) {
    const account = await prisma.account.findFirst({
      where: { id: accountId, householdId: household.id },
      select: { id: true },
    });
    if (!account) return { error: "계좌를 찾을 수 없어요." };
  }

  const data = { name, targetAmount, targetDate, accountId, startAmount };

  if (parsed.data.id) {
    // 다른 가구 목표를 고치지 못하게 householdId 를 조건에 함께 건다
    const updated = await prisma.savingsGoal.updateMany({
      where: { id: parsed.data.id, householdId: household.id },
      data,
    });
    if (updated.count === 0) return { error: "목표를 찾을 수 없어요." };
  } else {
    await prisma.savingsGoal.create({
      data: { ...data, householdId: household.id },
    });
  }

  revalidatePath("/", "layout");
  return { success: "저축 목표를 저장했어요." };
}

export async function deleteSavingsGoal(id: string) {
  const { household } = await requireHouseholdContext();

  await prisma.savingsGoal.deleteMany({
    where: { id, householdId: household.id },
  });

  revalidatePath("/", "layout");
  return { success: true };
}

/**
 * 예산 화면에서 한 번에 저장.
 *
 * 카테고리마다 따로 제출하면 왕복이 많고, 중간에 끊기면 일부만 반영돼
 * "배정 합계"가 어긋난다. 그래서 한 폼으로 받아 트랜잭션으로 처리한다.
 */
const bulkSchema = z.object({
  yearMonth: z.string().regex(/^\d{4}-\d{2}$/),
  entries: z
    .array(
      z.object({
        categoryId: z.string().uuid().nullable(),
        amount: z.coerce.number().int().min(0).max(1_000_000_000),
      }),
    )
    .max(100),
});

export async function saveBudgets(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  let entries: unknown = [];
  try {
    const raw = formData.get("entries");
    entries = raw ? JSON.parse(String(raw)) : [];
  } catch {
    return { error: "입력값을 확인해 주세요." };
  }

  const parsed = bulkSchema.safeParse({
    yearMonth: formData.get("yearMonth"),
    entries,
  });
  if (!parsed.success) return { error: "금액을 확인해 주세요." };

  const { household } = await requireHouseholdContext();
  const { yearMonth } = parsed.data;

  // 남의 가구 카테고리가 섞여 들어오지 못하게 한 번에 확인
  const categoryIds = parsed.data.entries
    .map((entry) => entry.categoryId)
    .filter((id): id is string => id !== null);

  if (categoryIds.length > 0) {
    const found = await prisma.category.count({
      where: { id: { in: categoryIds }, householdId: household.id },
    });
    if (found !== new Set(categoryIds).size) {
      return { error: "카테고리를 찾을 수 없어요." };
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const entry of parsed.data.entries) {
      const where = {
        householdId: household.id,
        yearMonth,
        categoryId: entry.categoryId,
      };

      if (entry.amount === 0) {
        await tx.budget.deleteMany({ where });
        continue;
      }

      const existing = await tx.budget.findFirst({
        where,
        select: { id: true },
      });

      if (existing) {
        await tx.budget.update({
          where: { id: existing.id },
          data: { amount: entry.amount },
        });
      } else {
        await tx.budget.create({ data: { ...where, amount: entry.amount } });
      }
    }
  });

  revalidatePath("/", "layout");
  return { success: "예산을 저장했어요." };
}
