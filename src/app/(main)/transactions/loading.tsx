import {
  HeaderSkeleton,
  SectionSkeleton,
  Skeleton,
} from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-4 px-4 py-4">
        {/* 수입/지출/합계 요약 */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="space-y-1.5">
              <Skeleton className="mx-auto h-3 w-8" />
              <Skeleton className="mx-auto h-4 w-16" />
            </div>
          ))}
        </div>

        {/* 필터 칩 */}
        <div className="flex gap-2">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-9 w-16 rounded-full" />
          ))}
        </div>

        <SectionSkeleton rows={4} />
        <SectionSkeleton rows={3} />
      </div>
    </>
  );
}
