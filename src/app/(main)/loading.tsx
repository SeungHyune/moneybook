import {
  HeaderSkeleton,
  SectionSkeleton,
  SummarySkeleton,
} from "@/components/ui/skeleton";

/** 홈 화면 로딩 상태 */
export default function HomeLoading() {
  return (
    <>
      <HeaderSkeleton />
      <div className="space-y-4 px-4 py-4">
        <SummarySkeleton />
        <SectionSkeleton rows={3} />
        <SectionSkeleton rows={2} />
      </div>
    </>
  );
}
