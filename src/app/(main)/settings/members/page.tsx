import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { InviteSection } from "@/components/invite-section";
import { MemberActions } from "@/components/member-actions";
import { requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";

export const metadata = { title: "구성원 관리" };

export default async function MembersPage() {
  const { household, member: me } = await requireHouseholdContext();

  const canManage = me.role === "OWNER" || me.role === "ADMIN";

  const [members, invites] = await Promise.all([
    prisma.householdMember.findMany({
      where: { householdId: household.id },
      include: { user: { select: { nickname: true, avatarUrl: true, email: true } } },
      orderBy: { joinedAt: "asc" },
    }),
    canManage
      ? prisma.invite.findMany({
          where: { householdId: household.id, status: "PENDING" },
          orderBy: { createdAt: "desc" },
        })
      : Promise.resolve([]),
  ]);

  const activeInvites = invites.filter(
    (invite) => invite.expiresAt > new Date() && invite.usedCount < invite.maxUses,
  );

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="flex h-14 items-center gap-1 px-2">
          <Link
            href="/settings"
            aria-label="뒤로"
            className="flex size-9 items-center justify-center rounded-full text-muted active:bg-surface-muted"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-base font-bold">구성원 관리</h1>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        {/* 구성원 목록 */}
        <section className="rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-bold">
            구성원 {members.length}명
          </h2>

          <ul className="divide-y divide-border">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 py-3 first:pt-0">
                <span
                  className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: `${member.color}22`,
                    color: member.color,
                  }}
                >
                  {member.user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={member.user.avatarUrl}
                      alt=""
                      className="size-full object-cover"
                    />
                  ) : (
                    (member.displayName ?? member.user.nickname).slice(0, 1)
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {member.displayName ?? member.user.nickname}
                    {member.id === me.id && (
                      <span className="ml-1 text-xs text-muted">(나)</span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted">
                    {MEMBER_ROLE_LABEL[member.role]}
                  </p>
                </div>

                {canManage && member.id !== me.id && member.role !== "OWNER" && (
                  <MemberActions memberId={member.id} role={member.role} />
                )}
              </li>
            ))}
          </ul>
        </section>

        {canManage ? (
          <InviteSection
            householdId={household.id}
            householdName={household.name}
            invites={activeInvites.map((invite) => ({
              id: invite.id,
              code: invite.code,
              role: invite.role,
              expiresAt: invite.expiresAt.toISOString(),
            }))}
          />
        ) : (
          <p className="rounded-2xl border border-border bg-surface p-4 text-center text-sm text-muted">
            구성원을 초대하려면 관리자 권한이 필요해요.
          </p>
        )}
      </div>
    </>
  );
}
