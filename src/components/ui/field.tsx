import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block space-y-1.5", className)}>
      <span className="block text-sm font-medium text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted">{hint}</span>}
    </label>
  );
}

const CONTROL_STYLE =
  "w-full rounded-xl border border-border bg-surface px-4 py-3 text-foreground outline-none transition focus:border-primary disabled:opacity-50";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(CONTROL_STYLE, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(CONTROL_STYLE, "appearance-none pr-10", className)}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(CONTROL_STYLE, "min-h-20 resize-none", className)}
      {...props}
    />
  );
}

/** 섹션 카드 */
export function Card({
  className,
  ...props
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-4",
        className,
      )}
      {...props}
    />
  );
}
