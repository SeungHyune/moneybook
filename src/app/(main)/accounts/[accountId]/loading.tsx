import { HeaderSkeleton, SectionSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-4 px-4 py-4">
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-border bg-surface p-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="mx-auto h-3 w-12" />
              <Skeleton className="mx-auto h-4 w-16" />
            </div>
          ))}
        </div>
        <SectionSkeleton rows={4} />
      </div>
    </>
  );
}
