import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-primary text-primary-foreground active:brightness-95 disabled:opacity-50",
  secondary:
    "bg-surface-muted text-foreground active:brightness-95 disabled:opacity-50",
  ghost: "text-muted active:bg-surface-muted disabled:opacity-50",
  danger: "bg-expense/10 text-expense active:bg-expense/20 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-4 text-sm rounded-xl",
  lg: "h-14 px-5 text-base rounded-2xl",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-bold transition active:scale-[0.98]",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
