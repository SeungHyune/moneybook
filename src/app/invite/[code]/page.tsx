import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { AcceptInviteButton } from "@/components/accept-invite-button";

export const metadata = { title: "가계부 초대" };

/**
 * 카카오톡으로 공유된 초대 링크.
 * 로그인하지 않았으면 로그인 후 이 페이지로 다시 돌아온다.
 */
export default async function InvitePage({
  params,
}: PageProps<"/invite/[code]">) {
  const { code } = await params;

  const invite = await prisma.invite.findUnique({
    where: { code },
    include: {
      household: {
        select: {
          name: true,
          _count: { select: { members: true } },
        },
      },
      invitedBy: { select: { nickname: true } },
    },
  });

  const user = await getCurrentUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${code}`)}`);
  }

  const isInvalid =
    !invite ||
    invite.status === "REVOKED" ||
    invite.expiresAt < new Date() ||
    invite.usedCount >= invite.maxUses;

  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-6 px-8 text-center">
      {isInvalid ? (
        <>
          <p className="text-4xl">😢</p>
          <div className="space-y-1">
            <h1 className="text-lg font-bold">사용할 수 없는 초대예요</h1>
            <p className="text-sm text-muted">
              만료됐거나 이미 사용된 초대 링크입니다.
              <br />
              배우자에게 새 링크를 요청해 주세요.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-xl bg-surface-muted px-5 py-3 text-sm font-bold"
          >
            홈으로
          </Link>
        </>
      ) : (
        <>
          <p className="text-4xl">💌</p>
          <div className="space-y-1">
            <h1 className="text-xl font-bold">{invite.household.name}</h1>
            <p className="text-sm text-muted">
              {invite.invitedBy.nickname}님이 초대했어요.
              <br />
              현재 {invite.household._count.members}명이 함께 쓰고 있습니다.
            </p>
          </div>

          <AcceptInviteButton code={code} />

          <p className="text-xs text-muted">
            합류하면 이 가계부의 모든 내역을 함께 보게 됩니다.
          </p>
        </>
      )}
    </main>
  );
}
