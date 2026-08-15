"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requireHouseholdContext } from "@/lib/auth";
import { MEMBER_FILTER_COOKIE } from "@/lib/member-filter";

/** 헤더의 구성원 보기 전환. null 이면 전체. */
export async function setMemberFilter(memberId: string | null) {
  const { household } = await requireHouseholdContext();
  const store = await cookies();

  if (!memberId) {
    store.delete(MEMBER_FILTER_COOKIE);
  } else {
    // 우리 가구 구성원인지 확인하고 저장
    const member = await prisma.householdMember.findFirst({
      where: { id: memberId, householdId: household.id },
      select: { id: true },
    });
    if (!member) return { error: "구성원을 찾을 수 없어요." };

    store.set(MEMBER_FILTER_COOKIE, memberId, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  }

  revalidatePath("/", "layout");
  return { success: true };
}
