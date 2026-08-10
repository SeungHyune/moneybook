import { BottomNav } from "@/components/bottom-nav";
import { requireHouseholdContext } from "@/lib/auth";

export default async function MainLayout({ children }: LayoutProps<"/">) {
  // 가구가 없으면 온보딩으로 보낸다
  await requireHouseholdContext();

  return (
    // 부모(.app-shell)가 스크롤 컨테이너이자 flex column 이다.
    // 여기서 본문을 flex-1 로 밀어두면 하단 탭이 항상 셸 바닥에 붙는다.
    <div className="flex min-h-full flex-1 flex-col">
      <div className="flex-1">{children}</div>
      <BottomNav />
    </div>
  );
}
