import Link from "next/link";
import type { ReactNode } from "react";
import { Settings } from "lucide-react";

export function AppHeader({
  title,
  subtitle,
  action,
  showSettings = false,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  showSettings?: boolean;
}) {
  return (
    <header
      className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur"
      style={{ paddingTop: "var(--safe-top)" }}
    >
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <div className="min-w-0">
          {/*
            문자열 제목만 truncate 되는 h1 로 감싼다.
            컴포넌트 제목(구성원 선택기 등)을 h1(truncate = overflow hidden)에
            넣으면 드롭다운 패널이 잘려서 안 보인다 — 그대로 렌더한다.
          */}
          {typeof title === "string" ? (
            <h1 className="truncate text-lg font-bold tracking-tight">
              {title}
            </h1>
          ) : (
            title
          )}
          {subtitle && (
            <p className="truncate text-xs text-muted">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {action}
          {showSettings && (
            <Link
              href="/settings"
              aria-label="설정"
              className="flex size-9 items-center justify-center rounded-full text-muted transition active:bg-surface-muted"
            >
              <Settings className="size-5" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
