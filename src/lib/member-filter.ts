import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "@/lib/prisma";

const COOKIE_NAME = "member-filter";

/**
 * 현재 선택된 "구성원 보기" 필터.
 *
 * 헤더에서 구성원을 고르면 쿠키에 저장되고, 홈/내역/카드 화면이
 * 그 구성원 기준으로 걸러진다. null 이면 전체(모든 구성원 합산).
 * 탈퇴했거나 다른 가구의 구성원 id 면 조용히 전체로 돌아간다.
 */
export const getMemberFilter = cache(async (householdId: string) => {
  const store = await cookies();
  const memberId = store.get(COOKIE_NAME)?.value;

  if (!memberId) return null;

  const member = await prisma.householdMember.findFirst({
    where: { id: memberId, householdId },
    select: {
      id: true,
      displayName: true,
      color: true,
      user: { select: { nickname: true } },
    },
  });

  return member ?? null;
});

export { COOKIE_NAME as MEMBER_FILTER_COOKIE };
