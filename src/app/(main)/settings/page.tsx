import Link from "next/link";
import { ChevronRight, LogOut, Users } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { HouseholdSettingsForm } from "@/components/household-settings-form";
import { ThemeSelector } from "@/components/theme-selector";
import { requireHouseholdContext } from "@/lib/auth";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";

export const metadata = { title: "설정" };

export default async function SettingsPage() {
  const { user, member, household, memberships } =
    await requireHouseholdContext();

  return (
    <>
      <AppHeader title="설정" />

      <div className="space-y-4 px-4 py-4">
        {/* 프로필 */}
        <section className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <span
            className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface-muted text-lg font-bold"
            style={{ backgroundColor: `${member.color}22`, color: member.color }}
          >
            {user.avatarUrl ? (
              // 카카오 프로필 이미지 (외부 도메인이라 next/image 대신 img 사용)
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatarUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              (member.displayName ?? user.nickname).slice(0, 1)
            )}
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">
              {member.displayName ?? user.nickname}
            </p>
            <p className="truncate text-xs text-muted">
              {user.email ?? "카카오 계정"} · {MEMBER_ROLE_LABEL[member.role]}
            </p>
          </div>
        </section>

        {/* 구성원 */}
        <Link
          href="/settings/members"
          className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition active:bg-surface-muted"
        >
          <Users className="size-5 shrink-0 text-muted" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">구성원 관리</p>
            <p className="text-xs text-muted">
              배우자 초대하고 권한을 관리해요
            </p>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted" />
        </Link>

        {/* 화면 테마 */}
        <ThemeSelector />

        {/* 가계부 설정 */}
        <HouseholdSettingsForm
          householdId={household.id}
          name={household.name}
          monthStartDay={household.monthStartDay}
          canEdit={member.role === "OWNER" || member.role === "ADMIN"}
        />

        {/* 여러 가계부를 쓰는 경우 */}
        {memberships.length > 1 && (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-sm font-bold">내 가계부</h2>
            <ul className="space-y-1">
              {memberships.map((membership) => (
                <li
                  key={membership.id}
                  className={`rounded-xl px-3 py-2.5 text-sm ${
                    membership.householdId === household.id
                      ? "bg-primary/10 font-bold text-primary"
                      : "text-muted"
                  }`}
                >
                  {membership.household.name}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 로그아웃 */}
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-4 text-sm font-medium text-muted transition active:bg-surface-muted"
          >
            <LogOut className="size-4" />
            로그아웃
          </button>
        </form>

        <p className="pb-4 text-center text-xs text-muted">
          우리집 가계부 v0.1.0
        </p>
      </div>
    </>
  );
}
