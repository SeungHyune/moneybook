import { cn } from "@/lib/utils";

/** 회색 블록 하나. 크기는 쓰는 쪽에서 클래스로 준다. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-surface-muted", className)}
      aria-hidden
    />
  );
}

/** 카드형 섹션 껍데기 (제목 + 줄 몇 개) */
export function SectionSkeleton({
  rows = 3,
  className,
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border bg-surface p-4",
        className,
      )}
    >
      <Skeleton className="h-4 w-24" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="flex items-center gap-3">
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-16 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 홈 상단의 파란 요약 카드 */
export function SummarySkeleton() {
  return (
    <div className="rounded-2xl bg-primary/80 p-5">
      <Skeleton className="h-3 w-20 bg-white/25" />
      <Skeleton className="mt-2 h-8 w-40 bg-white/30" />
      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/20 pt-4">
        {[0, 1].map((index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3 w-10 bg-white/25" />
            <Skeleton className="h-5 w-24 bg-white/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** 등록/수정 폼 자리 (뒤로가기 헤더 + 입력칸 몇 개) */
export function FormSkeleton({ fields = 5 }: { fields?: number }) {
  return (
    <>
      <div
        className="sticky top-0 z-30 border-b border-border bg-background/90"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-5 w-24" />
          <div className="size-8" />
        </div>
      </div>

      <div className="space-y-5 px-4 py-4">
        {Array.from({ length: fields }, (_, index) => (
          <div key={index} className="space-y-1.5">
            <Skeleton className="h-3.5 w-16" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        ))}
        <Skeleton className="h-14 w-full rounded-2xl" />
      </div>
    </>
  );
}

/** 상단 헤더 + 월 선택기 자리 */
export function HeaderSkeleton({ withMonth = true }: { withMonth?: boolean }) {
  return (
    <>
      <div
        className="sticky top-0 z-30 border-b border-border bg-background/90"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="size-8 rounded-full" />
        </div>
      </div>

      {withMonth && (
        <div className="flex items-center justify-center gap-2 px-4 pt-4">
          <Skeleton className="size-9 rounded-full" />
          <Skeleton className="h-5 w-24" />
          <Skeleton className="size-9 rounded-full" />
        </div>
      )}
    </>
  );
}
