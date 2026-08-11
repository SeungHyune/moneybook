import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function FixedLoading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-4 px-4 py-4">
        {/* 고정 수입 / 고정 지출 */}
        <div className="grid grid-cols-2 gap-3">
          {[0, 1].map((index) => (
            <div
              key={index}
              className="space-y-2 rounded-2xl border border-border bg-surface p-4"
            >
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-24" />
            </div>
          ))}
        </div>

        <ul className="space-y-2">
          {[0, 1, 2, 3].map((index) => (
            <li
              key={index}
              className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-4 w-24" />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
