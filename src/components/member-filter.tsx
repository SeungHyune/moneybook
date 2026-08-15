"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Users } from "lucide-react";
import { setMemberFilter } from "@/app/actions/member-filter";
import { cn } from "@/lib/utils";

export type FilterMember = {
  id: string;
  displayName: string | null;
  color: string;
  nickname: string;
};

/**
 * 헤더의 "누구 기준으로 볼지" 선택.
 * 전체(구성원 합산)가 기본이고, 한 명을 고르면 그 사람의
 * 내역·카드·계좌만 보인다.
 */
export function MemberFilter({
  householdName,
  members,
  selectedId,
}: {
  householdName: string;
  members: FilterMember[];
  selectedId: string | null;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = members.find((member) => member.id === selectedId) ?? null;

  // 바깥을 누르면 닫힘
  useEffect(() => {
    if (!isOpen) return;

    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  function choose(memberId: string | null) {
    setIsOpen(false);
    startTransition(async () => {
      await setMemberFilter(memberId);
      router.refresh();
    });
  }

  const label = (member: FilterMember) => member.displayName ?? member.nickname;

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setIsOpen((value) => !value)}
        aria-expanded={isOpen}
        aria-label="보기 기준 선택"
        className={cn(
          "flex min-w-0 items-center gap-1.5 rounded-xl py-1 pr-2 text-left transition active:bg-surface-muted",
          isPending && "opacity-60",
        )}
      >
        <div className="min-w-0">
          <span className="block truncate text-lg font-bold tracking-tight">
            {householdName}
          </span>
          <span className="flex items-center gap-1 text-xs text-muted">
            {selected ? (
              <>
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: selected.color }}
                  aria-hidden
                />
                {label(selected)}
              </>
            ) : (
              <>
                <Users className="size-3" aria-hidden />
                전체
              </>
            )}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-1 w-52 overflow-hidden rounded-2xl border border-border bg-surface shadow-lg"
          role="listbox"
        >
          <Option
            active={selectedId === null}
            onClick={() => choose(null)}
            dot={
              <span className="flex size-6 items-center justify-center rounded-full bg-surface-muted">
                <Users className="size-3.5 text-muted" />
              </span>
            }
            title="전체"
            subtitle="구성원 모두 합산"
          />

          {members.map((member) => (
            <Option
              key={member.id}
              active={selectedId === member.id}
              onClick={() => choose(member.id)}
              dot={
                <span
                  className="flex size-6 items-center justify-center rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: `${member.color}22`,
                    color: member.color,
                  }}
                >
                  {label(member).slice(0, 1)}
                </span>
              }
              title={label(member)}
              subtitle="이 사람 것만 보기"
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Option({
  active,
  onClick,
  dot,
  title,
  subtitle,
}: {
  active: boolean;
  onClick: () => void;
  dot: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition active:bg-surface-muted",
        active && "bg-primary/5",
      )}
    >
      {dot}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        <span className="block text-[11px] text-muted">{subtitle}</span>
      </span>
      {active && <Check className="size-4 shrink-0 text-primary" />}
    </button>
  );
}
