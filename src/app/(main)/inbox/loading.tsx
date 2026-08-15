import { HeaderSkeleton, SectionSkeleton } from "@/components/ui/skeleton";

export default function InboxLoading() {
  return (
    <>
      <HeaderSkeleton withMonth={false} />
      <div className="space-y-4 px-4 py-4">
        <SectionSkeleton rows={2} />
        <SectionSkeleton rows={2} />
      </div>
    </>
  );
}
