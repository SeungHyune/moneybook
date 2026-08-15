"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Smartphone } from "lucide-react";
import {
  disableIngestToken,
  regenerateIngestToken,
} from "@/app/actions/ingest";
import { Button } from "@/components/ui/button";

/**
 * 자동 수집 설정.
 * 안드로이드: MacroDroid 가 카드 알림을 감지해 우리 API 로 보낸다.
 * 아이폰: 문자 알림을 켰다면 단축어로 같은 API 를 부를 수 있다.
 */
export function IngestSettings({ token }: { token: string | null }) {
  const [currentToken, setCurrentToken] = useState(token);
  const [copied, setCopied] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [isPending, startTransition] = useTransition();

  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : "https://moneybook-delta.vercel.app";

  const webhookUrl = currentToken
    ? `${origin}/api/ingest?token=${currentToken}&source=macrodroid`
    : null;

  async function copy(value: string, key: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // 클립보드 권한이 없으면 무시
    }
  }

  function regenerate() {
    startTransition(async () => {
      const result = await regenerateIngestToken();
      if ("token" in result) setCurrentToken(result.token);
    });
  }

  function disable() {
    if (!confirm("자동 수집을 끌까요? 연결된 기기의 전송이 모두 막힙니다."))
      return;
    startTransition(async () => {
      await disableIngestToken();
      setCurrentToken(null);
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-bold">
        <Smartphone className="size-4" />
        자동 수집 (안드로이드)
      </h2>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">
        카드 승인 알림을 감지해 가계부에 자동으로 기록해요. 등록된 카드
        끝 4자리와 일치하면 바로 등록되고, 아니면 수신함에서 확인 후 등록해요.
      </p>

      <div className="mt-3 space-y-3">
        {!currentToken ? (
          <Button
            type="button"
            size="md"
            className="w-full"
            onClick={regenerate}
            disabled={isPending}
          >
            연결 키 만들기
          </Button>
        ) : (
          <>
            <div className="space-y-1.5">
              <span className="block text-xs font-medium text-muted">
                전송 주소 (MacroDroid 에 붙여넣기)
              </span>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-xl bg-surface-muted px-3 py-2.5 text-xs">
                  {webhookUrl}
                </code>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => copy(webhookUrl!, "url")}
                  aria-label="주소 복사"
                >
                  {copied === "url" ? (
                    <Check className="size-4" />
                  ) : (
                    <Copy className="size-4" />
                  )}
                </Button>
              </div>
              <p className="text-[11px] text-muted">
                이 주소에는 내 연결 키가 들어 있어요. 다른 사람과 공유하지 마세요.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowGuide((value) => !value)}
              className="text-xs font-medium text-primary underline underline-offset-2"
            >
              {showGuide ? "설정 방법 접기" : "MacroDroid 설정 방법 보기"}
            </button>

            {showGuide && (
              <ol className="list-decimal space-y-1.5 rounded-xl bg-surface-muted px-3 py-3 pl-7 text-xs leading-relaxed text-muted">
                <li>
                  Play 스토어에서 <strong className="text-foreground">MacroDroid</strong>{" "}
                  설치 (무료)
                </li>
                <li>
                  새 매크로 → 트리거:{" "}
                  <strong className="text-foreground">알림 → 알림 수신</strong> →
                  카드사 앱 선택 (여러 개 가능)
                </li>
                <li>
                  액션: <strong className="text-foreground">HTTP 요청</strong> →
                  방식 <strong className="text-foreground">POST</strong> → URL 에
                  위 주소 붙여넣기
                </li>
                <li>
                  본문(Content body) 에{" "}
                  <code className="text-foreground">
                    {"[notification_title] [notification_text]"}
                  </code>{" "}
                  입력 (매직 변수)
                </li>
                <li>저장 후 카드로 결제해 보면 가계부에 자동으로 쌓여요</li>
              </ol>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="flex-1"
                onClick={regenerate}
                disabled={isPending}
              >
                키 재발급
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={disable}
                disabled={isPending}
              >
                끄기
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
