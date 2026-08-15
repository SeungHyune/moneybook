"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestPush,
} from "@/app/actions/push";
import { Button } from "@/components/ui/button";

type PushState =
  | "loading" //  확인 중
  | "unsupported" //  브라우저가 푸시를 지원하지 않음
  | "ios-not-installed" //  iOS 인데 홈 화면 설치 전 (설치해야 푸시 가능)
  | "denied" //  권한 거부됨
  | "off" //  구독 안 함
  | "on"; //  구독됨

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function NotificationSettings() {
  const [state, setState] = useState<PushState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    async function detect() {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // iOS Safari 탭에서는 PushManager 자체가 없다 → 설치 안내
        const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
        const isStandalone = window.matchMedia(
          "(display-mode: standalone)",
        ).matches;
        setState(isIos && !isStandalone ? "ios-not-installed" : "unsupported");
        return;
      }

      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        setState(subscription ? "on" : "off");
      } catch {
        setState("off");
      }
    }

    void detect();
  }, []);

  function subscribe() {
    startTransition(async () => {
      setMessage(null);
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") {
          setState("denied");
          return;
        }

        const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!publicKey) {
          setMessage("서버에 푸시 키가 설정되지 않았어요.");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });

        const result = await savePushSubscription(
          subscription.toJSON(),
          navigator.userAgent,
        );
        if (result.error) {
          setMessage(result.error);
          return;
        }

        setState("on");
        setMessage("이 기기에서 알림을 받아요.");
      } catch {
        setMessage(
          "구독에 실패했어요. 앱을 완전히 닫았다 다시 열어 보세요.",
        );
      }
    });
  }

  function unsubscribe() {
    startTransition(async () => {
      setMessage(null);
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          await removePushSubscription(subscription.endpoint);
          await subscription.unsubscribe();
        }
        setState("off");
      } catch {
        setMessage("해제에 실패했어요.");
      }
    });
  }

  function test() {
    startTransition(async () => {
      const result = await sendTestPush();
      setMessage(result.error ?? result.success ?? null);
    });
  }

  return (
    <section className="rounded-2xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-1.5 text-sm font-bold">
        <Bell className="size-4" />
        푸시 알림
      </h2>
      <p className="mt-0.5 text-xs leading-relaxed text-muted">
        고정지출 납부일과 카드 결제일을 아침에 알려드려요.
      </p>

      <div className="mt-3">
        {state === "loading" && (
          <p className="text-sm text-muted">확인 중...</p>
        )}

        {state === "unsupported" && (
          <p className="text-sm text-muted">
            이 브라우저는 푸시 알림을 지원하지 않아요.
          </p>
        )}

        {state === "ios-not-installed" && (
          <p className="rounded-xl bg-surface-muted px-3 py-2.5 text-xs leading-relaxed text-muted">
            아이폰은 <strong className="text-foreground">홈 화면에 추가</strong>한
            앱에서만 알림을 받을 수 있어요.
            <br />
            Safari 공유 버튼 → &ldquo;홈 화면에 추가&rdquo; 후, 설치된 앱에서 다시
            켜 주세요.
          </p>
        )}

        {state === "denied" && (
          <p className="rounded-xl bg-warning/10 px-3 py-2.5 text-xs leading-relaxed text-warning">
            알림 권한이 꺼져 있어요. 휴대폰 설정에서 이 앱의 알림을 허용한 뒤
            다시 시도해 주세요.
          </p>
        )}

        {state === "off" && (
          <Button
            type="button"
            size="md"
            className="w-full"
            onClick={subscribe}
            disabled={isPending}
          >
            <Bell className="size-4" />
            이 기기에서 알림 받기
          </Button>
        )}

        {state === "on" && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="md"
              variant="secondary"
              className="flex-1"
              onClick={test}
              disabled={isPending}
            >
              <Send className="size-4" />
              테스트 알림
            </Button>
            <Button
              type="button"
              size="md"
              variant="ghost"
              onClick={unsubscribe}
              disabled={isPending}
            >
              <BellOff className="size-4" />
              끄기
            </Button>
          </div>
        )}

        {message && (
          <p className="mt-2 text-xs text-muted" role="status">
            {message}
          </p>
        )}
      </div>
    </section>
  );
}
