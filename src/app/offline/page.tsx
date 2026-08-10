import { WifiOff } from "lucide-react";

export const metadata = {
  title: "오프라인",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-full flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-surface-muted">
        <WifiOff className="size-7 text-muted" aria-hidden />
      </div>
      <div className="space-y-1">
        <h1 className="text-lg font-bold">인터넷에 연결되어 있지 않아요</h1>
        <p className="text-sm text-muted">
          네트워크가 돌아오면 자동으로 다시 불러옵니다.
        </p>
      </div>
    </main>
  );
}
