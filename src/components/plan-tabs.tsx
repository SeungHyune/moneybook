"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * "계획" 탭 — 예산과 고정지출을 오간다.
 *
 * 레이아웃으로 빼지 않고 각 페이지가 직접 그린다. 페이지마다 헤더의
 * 액션 버튼이 달라서(예산 수정 / 고정지출 추가) 공용 헤더로 묶기 어렵고,
 * /fixed/new 같은 하위 폼 화면에는 이 탭이 나오면 안 되기 때문이다.
 */
const TABS = [
  { href: "/budget", label: "예산" },
  { href: "/fixed", label: "고정지출" },
] as const;

export function PlanTabs() {
  const pathname = usePathname();

  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={cn(
            "rounded-lg py-2 text-center text-sm font-bold transition",
            pathname === tab.href
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
