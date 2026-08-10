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
          <h1 className="truncate text-lg font-bold tracking-tight">{title}</h1>
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
