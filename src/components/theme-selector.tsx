"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  getServerTheme,
  getTheme,
  setTheme,
  subscribeTheme,
  type Theme,
} from "@/lib/theme";
import { cn } from "@/lib/utils";

const OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "system", label: "시스템", icon: Monitor },
  { value: "light", label: "라이트", icon: Sun },
  { value: "dark", label: "다크", icon: Moon },
];

export function ThemeSelector() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="text-sm font-bold">화면 테마</h2>
      <p className="mt-0.5 text-xs text-muted">
        시스템을 고르면 휴대폰 설정에 따라 자동으로 바뀝니다.
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const isActive = theme === value;

          return (
            <button
              key={value}
              type="button"
              onClick={() => setTheme(value)}
              aria-pressed={isActive}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border py-3 text-xs font-medium transition",
                isActive
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-surface text-muted",
              )}
            >
              <Icon className="size-5" />
              {label}
            </button>
          );
        })}
      </div>
    </section>
  );
}
