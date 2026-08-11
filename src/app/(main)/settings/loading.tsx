import { HeaderSkeleton, SectionSkeleton, Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <>
      <HeaderSkeleton withMonth={false} />
      <div className="space-y-4 px-4 py-4">
        {/* 프로필 */}
        <div className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4">
          <Skeleton className="size-12 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-40" />
          </div>
        </div>
        <SectionSkeleton rows={1} />
        <SectionSkeleton rows={2} />
      </div>
    </>
  );
}
