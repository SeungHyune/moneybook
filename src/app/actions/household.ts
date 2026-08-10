"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMembership, requireUser } from "@/lib/auth";
import { DEFAULT_CATEGORIES } from "@/lib/default-data";
import { generateInviteCode } from "@/lib/utils";
import type { MemberRole } from "@/generated/prisma/enums";

export type ActionState = { error?: string; success?: string } | null;

const createHouseholdSchema = z.object({
  name: z.string().trim().min(1, "가계부 이름을 입력해 주세요.").max(30),
  displayName: z.string().trim().max(20).optional(),
});

/** 새 가계부(가구)를 만들고 기본 카테고리를 깔아준다. */
export async function createHousehold(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = createHouseholdSchema.safeParse({
    name: formData.get("name"),
    displayName: formData.get("displayName") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해 주세요." };
  }

  const household = await prisma.$transaction(async (tx) => {
    const created = await tx.household.create({
      data: {
        name: parsed.data.name,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
            displayName: parsed.data.displayName ?? user.nickname,
          },
        },
        categories: {
          create: DEFAULT_CATEGORIES.map((category, index) => ({
            ...category,
            isSystem: true,
            sortOrder: index,
          })),
        },
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { lastHouseholdId: created.id },
    });

    return created;
  });

  revalidatePath("/", "layout");
  redirect(`/?household=${household.id}`);
}

/** 현재 보고 있는 가계부 전환 */
export async function switchHousehold(householdId: string) {
  const { user } = await requireMembership(householdId, "VIEWER");

  await prisma.user.update({
    where: { id: user.id },
    data: { lastHouseholdId: householdId },
  });

  revalidatePath("/", "layout");
}

const inviteSchema = z.object({
  householdId: z.string().uuid(),
  role: z.enum(["ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
  /** 유효기간(일) */
  expiresInDays: z.coerce.number().int().min(1).max(30).default(7),
});

/** 초대 코드 생성. 카카오톡으로 링크를 보내면 상대가 눌러서 합류한다. */
export async function createInvite(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = inviteSchema.safeParse({
    householdId: formData.get("householdId"),
    role: formData.get("role") ?? undefined,
    expiresInDays: formData.get("expiresInDays") ?? undefined,
  });

  if (!parsed.success) {
    return { error: "초대 정보를 확인해 주세요." };
  }

  const { user } = await requireMembership(parsed.data.householdId, "ADMIN");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + parsed.data.expiresInDays);

  // 코드 충돌 시 몇 번 다시 시도
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await prisma.invite.create({
        data: {
          householdId: parsed.data.householdId,
          code: generateInviteCode(),
          role: parsed.data.role as MemberRole,
          invitedById: user.id,
          expiresAt,
        },
      });

      revalidatePath("/settings/members");
      return { success: "초대 링크를 만들었어요." };
    } catch (error) {
      const isUniqueViolation =
        error instanceof Error && error.message.includes("Unique constraint");
      if (!isUniqueViolation) throw error;
    }
  }

  return { error: "초대 코드 생성에 실패했어요. 다시 시도해 주세요." };
}

/** 초대 링크로 합류 */
export async function acceptInvite(code: string) {
  const user = await requireUser();

  const invite = await prisma.invite.findUnique({
    where: { code },
    include: { household: true },
  });

  if (!invite) {
    return { error: "존재하지 않는 초대 코드예요." };
  }
  if (invite.status === "REVOKED") {
    return { error: "취소된 초대예요." };
  }
  if (invite.expiresAt < new Date()) {
    return { error: "만료된 초대예요. 새 링크를 요청해 주세요." };
  }
  if (invite.usedCount >= invite.maxUses) {
    return { error: "이미 사용된 초대예요." };
  }

  const existing = await prisma.householdMember.findUnique({
    where: {
      householdId_userId: { householdId: invite.householdId, userId: user.id },
    },
  });

  if (existing) {
    await prisma.user.update({
      where: { id: user.id },
      data: { lastHouseholdId: invite.householdId },
    });
    return { alreadyMember: true, householdName: invite.household.name };
  }

  await prisma.$transaction(async (tx) => {
    await tx.householdMember.create({
      data: {
        householdId: invite.householdId,
        userId: user.id,
        role: invite.role,
        displayName: user.nickname,
        color: "#ec4899",
      },
    });

    const usedCount = invite.usedCount + 1;
    await tx.invite.update({
      where: { id: invite.id },
      data: {
        usedCount,
        status: usedCount >= invite.maxUses ? "ACCEPTED" : "PENDING",
      },
    });

    await tx.user.update({
      where: { id: user.id },
      data: { lastHouseholdId: invite.householdId },
    });
  });

  revalidatePath("/", "layout");
  return { success: true, householdName: invite.household.name };
}

export async function revokeInvite(inviteId: string) {
  const invite = await prisma.invite.findUnique({ where: { id: inviteId } });
  if (!invite) return;

  await requireMembership(invite.householdId, "ADMIN");

  await prisma.invite.update({
    where: { id: inviteId },
    data: { status: "REVOKED" },
  });

  revalidatePath("/settings/members");
}

export async function updateMemberRole(memberId: string, role: MemberRole) {
  const member = await prisma.householdMember.findUnique({
    where: { id: memberId },
  });
  if (!member) return { error: "구성원을 찾을 수 없어요." };

  const { member: actor } = await requireMembership(member.householdId, "ADMIN");

  if (member.role === "OWNER") {
    return { error: "개설자의 권한은 바꿀 수 없어요." };
  }
  if (member.id === actor.id) {
    return { error: "본인 권한은 바꿀 수 없어요." };
  }

  await prisma.householdMember.update({
    where: { id: memberId },
    data: { role },
  });

  revalidatePath("/settings/members");
  return { success: true };
}

export async function removeMember(memberId: string) {
  const member = await prisma.householdMember.findUnique({
    where: { id: memberId },
  });
  if (!member) return { error: "구성원을 찾을 수 없어요." };

  const { member: actor } = await requireMembership(member.householdId, "ADMIN");

  if (member.role === "OWNER") {
    return { error: "개설자는 내보낼 수 없어요." };
  }
  if (member.id === actor.id) {
    return { error: "본인은 내보낼 수 없어요." };
  }

  await prisma.householdMember.delete({ where: { id: memberId } });

  revalidatePath("/settings/members");
  return { success: true };
}

const updateHouseholdSchema = z.object({
  householdId: z.string().uuid(),
  name: z.string().trim().min(1).max(30),
  monthStartDay: z.coerce.number().int().min(1).max(28),
});

export async function updateHousehold(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = updateHouseholdSchema.safeParse({
    householdId: formData.get("householdId"),
    name: formData.get("name"),
    monthStartDay: formData.get("monthStartDay"),
  });

  if (!parsed.success) {
    return { error: "입력값을 확인해 주세요." };
  }

  await requireMembership(parsed.data.householdId, "ADMIN");

  await prisma.household.update({
    where: { id: parsed.data.householdId },
    data: {
      name: parsed.data.name,
      monthStartDay: parsed.data.monthStartDay,
    },
  });

  revalidatePath("/", "layout");
  return { success: "저장했어요." };
}
