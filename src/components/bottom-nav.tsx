"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, CreditCard, Home, Plus, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "홈", icon: Home },
  { href: "/transactions", label: "내역", icon: Receipt },
  { href: "/fixed", label: "고정지출", icon: CalendarClock },
  { href: "/cards", label: "카드/자산", icon: CreditCard },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    // sticky bottom-0: 스크롤 컨테이너(.app-shell) 바닥에 붙는다.
    // fixed 를 쓰면 넓은 화면에서 폰 프레임을 뚫고 화면 전체에 깔린다.
    <nav
      className="sticky bottom-0 z-40 shrink-0 border-t border-border bg-surface/95 backdrop-blur"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <div className="flex h-16 items-stretch justify-around px-2">
        {TABS.map(({ href, label, icon: Icon }, index) => {
          const isActive =
            href === "/" ? pathname === "/" : pathname.startsWith(href);

          // 가운데에 등록 버튼을 끼워 넣는다
          const showAddButton = index === 2;

          return (
            <div key={href} className="contents">
              {showAddButton && <AddButton />}
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition",
                  isActive ? "text-primary" : "text-muted",
                )}
              >
                <Icon className="size-5" strokeWidth={isActive ? 2.4 : 1.8} />
                {label}
              </Link>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

function AddButton() {
  return (
    <div className="flex flex-1 items-start justify-center">
      <Link
        href="/transactions/new"
        aria-label="내역 등록"
        className="-mt-5 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition active:scale-95"
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </Link>
    </div>
  );
}
