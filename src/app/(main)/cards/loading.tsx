import { HeaderSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function CardsLoading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-4 px-4 py-4">
        {/* 총 자산 / 카드 청구 예정 */}
        <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          {[0, 1].map((index) => (
            <div key={index} className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-28" />
            </div>
          ))}
        </div>

        <Skeleton className="h-4 w-12" />

        <ul className="space-y-2">
          {[0, 1].map((index) => (
            <li
              key={index}
              className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4"
            >
              <Skeleton className="h-10 w-1.5 shrink-0 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3.5 w-36" />
                <Skeleton className="h-3 w-48" />
              </div>
              <Skeleton className="h-4 w-20 shrink-0" />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
