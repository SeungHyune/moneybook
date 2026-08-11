import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole } from "@/generated/prisma/enums";

/**
 * Supabase 로그인 유저를 우리 DB 의 User 로 맞춰준다.
 * 카카오 로그인은 user_metadata 에 nickname/profile 이 들어온다.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) return null;

  const meta = authUser.user_metadata ?? {};
  const nickname =
    meta.name ??
    meta.full_name ??
    meta.nickname ??
    meta.preferred_username ??
    authUser.email?.split("@")[0] ??
    "사용자";
  const avatarUrl = meta.avatar_url ?? meta.picture ?? null;
  const kakaoId =
    authUser.app_metadata?.provider === "kakao"
      ? (meta.provider_id ?? meta.sub ?? null)
      : null;

  // 첫 로그인이면 프로필을 만들고, 이미 있으면 카카오 프로필 변경분만 반영한다.
  return prisma.user.upsert({
    where: { id: authUser.id },
    create: {
      id: authUser.id,
      email: authUser.email ?? null,
      nickname,
      avatarUrl,
      kakaoId: kakaoId ? String(kakaoId) : null,
    },
    update: {
      email: authUser.email ?? null,
      avatarUrl,
    },
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export type HouseholdContext = NonNullable<
  Awaited<ReturnType<typeof getHouseholdContext>>
>;

/**
 * 현재 사용자가 보고 있는 가구와 그 안에서의 멤버 정보를 함께 가져온다.
 * 가구가 하나도 없으면 null -> 온보딩으로 보낸다.
 */
export const getHouseholdContext = cache(async () => {
  const user = await getCurrentUser();
  if (!user) return null;

  const memberships = await prisma.householdMember.findMany({
    where: { userId: user.id },
    include: { household: true },
    orderBy: { joinedAt: "asc" },
  });

  if (memberships.length === 0) return null;

  const active =
    memberships.find((m) => m.householdId === user.lastHouseholdId) ??
    memberships[0];

  return {
    user,
    member: active,
    household: active.household,
    memberships,
  };
});

export async function requireHouseholdContext() {
  const user = await requireUser();
  const context = await getHouseholdContext();

  if (!context) redirect("/onboarding");
  void user;
  return context;
}

const ROLE_RANK: Record<MemberRole, number> = {
  VIEWER: 0,
  MEMBER: 1,
  ADMIN: 2,
  OWNER: 3,
};

export function hasRole(role: MemberRole, required: MemberRole) {
  return ROLE_RANK[role] >= ROLE_RANK[required];
}

/**
 * 카드/계좌를 수정·삭제할 수 있는지.
 *
 * - ADMIN/OWNER : 누가 등록한 것이든 전부
 * - MEMBER      : 자기가 등록한 것만
 * - VIEWER      : 불가
 */
export function canManageAsset(
  member: { id: string; role: MemberRole },
  asset: { createdByMemberId: string | null },
) {
  if (member.role === "VIEWER") return false;
  if (hasRole(member.role, "ADMIN")) return true;
  return asset.createdByMemberId === member.id;
}

/**
 * 카드/계좌를 등록할 때 "누구 것"으로 지정할 수 있는지.
 *
 * 구성원은 본인 또는 공용(null)만 고를 수 있고,
 * 관리자는 아무 구성원이나 지정할 수 있다.
 */
export function canAssignOwner(
  member: { id: string; role: MemberRole },
  ownerMemberId: string | null,
) {
  if (hasRole(member.role, "ADMIN")) return true;
  return ownerMemberId === null || ownerMemberId === member.id;
}

/**
 * 서버 액션에서 쓰는 권한 체크.
 * Prisma 는 Supabase RLS 를 우회하므로(서비스 커넥션으로 붙는다)
 * 가구 데이터에 손대기 전에 반드시 이 함수를 거쳐야 한다.
 */
export async function requireMembership(
  householdId: string,
  required: MemberRole = "MEMBER",
) {
  const user = await requireUser();

  const member = await prisma.householdMember.findUnique({
    where: { householdId_userId: { householdId, userId: user.id } },
    include: { household: true },
  });

  if (!member) {
    throw new Error("이 가계부에 접근할 권한이 없습니다.");
  }
  if (!hasRole(member.role, required)) {
    throw new Error("권한이 부족합니다.");
  }

  return { user, member, household: member.household };
}
