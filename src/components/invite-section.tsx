"use client";

import { useActionState, useState, useTransition } from "react";
import { Check, Copy, Share2, Trash2 } from "lucide-react";
import { createInvite, revokeInvite } from "@/app/actions/household";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Field, Select } from "@/components/ui/field";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";
import type { MemberRole } from "@/generated/prisma/enums";

type Invite = {
  id: string;
  code: string;
  role: MemberRole;
  expiresAt: string;
};

export function InviteSection({
  householdId,
  householdName,
  invites,
}: {
  householdId: string;
  householdName: string;
  invites: Invite[];
}) {
  const [state, formAction] = useActionState(createInvite, null);

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-surface p-4">
      <div>
        <h2 className="text-sm font-bold">배우자 초대하기</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-muted">
          초대 링크를 만들어 카카오톡으로 보내세요.
          <br />
          상대가 링크를 눌러 카카오로 로그인하면 바로 합류됩니다.
        </p>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="householdId" value={householdId} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="권한">
            <Select name="role" defaultValue="MEMBER">
              <option value="MEMBER">{MEMBER_ROLE_LABEL.MEMBER}</option>
              <option value="ADMIN">{MEMBER_ROLE_LABEL.ADMIN}</option>
              <option value="VIEWER">{MEMBER_ROLE_LABEL.VIEWER}</option>
            </Select>
          </Field>

          <Field label="유효기간">
            <Select name="expiresInDays" defaultValue="7">
              <option value="1">1일</option>
              <option value="7">7일</option>
              <option value="30">30일</option>
            </Select>
          </Field>
        </div>

        {state?.error && (
          <p className="text-sm text-expense" role="alert">
            {state.error}
          </p>
        )}

        <SubmitButton size="md" className="w-full" pendingText="만드는 중...">
          초대 링크 만들기
        </SubmitButton>
      </form>

      {invites.length > 0 && (
        <ul className="space-y-2 border-t border-border pt-4">
          {invites.map((invite) => (
            <InviteRow
              key={invite.id}
              invite={invite}
              householdName={householdName}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function InviteRow({
  invite,
  householdName,
}: {
  invite: Invite;
  householdName: string;
}) {
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // 클라이언트에서 만들어야 배포 도메인이 그대로 반영된다
  const link =
    typeof window === "undefined"
      ? `/invite/${invite.code}`
      : `${window.location.origin}/invite/${invite.code}`;

  const shareText = `${householdName} 가계부에 초대합니다.\n${link}`;

  async function handleShare() {
    // 모바일이면 공유 시트가 떠서 카카오톡을 바로 고를 수 있다
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${householdName} 가계부 초대`,
          text: `${householdName} 가계부에 초대합니다.`,
          url: link,
        });
        return;
      } catch {
        // 사용자가 공유를 취소한 경우 — 복사로 폴백
      }
    }

    await handleCopy();
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 클립보드 권한이 없으면 그냥 넘어간다
    }
  }

  function handleRevoke() {
    startTransition(async () => {
      await revokeInvite(invite.id);
    });
  }

  const daysLeft = Math.max(
    0,
    Math.ceil(
      (new Date(invite.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    ),
  );

  return (
    <li className="space-y-2 rounded-xl bg-surface-muted p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="tabular text-lg font-bold tracking-[0.2em]">
          {invite.code}
        </span>
        <span className="shrink-0 text-xs text-muted">
          {MEMBER_ROLE_LABEL[invite.role]} · {daysLeft}일 남음
        </span>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={handleShare}
        >
          <Share2 className="size-4" />
          공유하기
        </Button>

        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleCopy}
          aria-label="링크 복사"
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="danger"
          onClick={handleRevoke}
          disabled={isPending}
          aria-label="초대 취소"
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}
