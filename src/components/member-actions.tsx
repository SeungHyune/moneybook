"use client";

import { useTransition } from "react";
import { removeMember, updateMemberRole } from "@/app/actions/household";
import { MEMBER_ROLE_LABEL } from "@/lib/labels";
import type { MemberRole } from "@/generated/prisma/enums";

export function MemberActions({
  memberId,
  role,
}: {
  memberId: string;
  role: MemberRole;
}) {
  const [isPending, startTransition] = useTransition();

  function handleRoleChange(nextRole: MemberRole) {
    startTransition(async () => {
      await updateMemberRole(memberId, nextRole);
    });
  }

  function handleRemove() {
    if (!confirm("이 구성원을 내보낼까요? 입력한 내역은 그대로 남습니다.")) {
      return;
    }
    startTransition(async () => {
      await removeMember(memberId);
    });
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <select
        value={role}
        disabled={isPending}
        onChange={(event) =>
          handleRoleChange(event.target.value as MemberRole)
        }
        aria-label="권한 변경"
        className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs"
      >
        {(["ADMIN", "MEMBER", "VIEWER"] as const).map((option) => (
          <option key={option} value={option}>
            {MEMBER_ROLE_LABEL[option]}
          </option>
        ))}
      </select>

      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="rounded-lg px-2 py-1.5 text-xs text-expense disabled:opacity-50"
      >
        내보내기
      </button>
    </div>
  );
}
