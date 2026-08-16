"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * 앱으로 돌아올 때 화면을 최신으로.
 *
 * iOS 홈 화면 앱은 백그라운드에서 재개하면 이전 화면을 메모리에서 그대로
 * 보여준다 — 새 배포도, 배우자가 그새 입력한 내역도 반영되지 않는다.
 * 다시 보이는 순간 서버 데이터를 다시 받아온다. (가계부는 신선함이 중요하다)
 *
 * 과호출 방지로 30초 안에 다시 돌아오면 건너뛴다.
 */
const MIN_INTERVAL_MS = 30_000;

export function AutoRefresh() {
  const router = useRouter();
  const lastRefreshRef = useRef(Date.now());

  useEffect(() => {
    function refreshIfStale() {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastRefreshRef.current < MIN_INTERVAL_MS) return;

      lastRefreshRef.current = now;
      router.refresh();
    }

    document.addEventListener("visibilitychange", refreshIfStale);
    window.addEventListener("focus", refreshIfStale);
    // iOS 가 페이지를 bfcache 에서 되살릴 때
    window.addEventListener("pageshow", refreshIfStale);

    return () => {
      document.removeEventListener("visibilitychange", refreshIfStale);
      window.removeEventListener("focus", refreshIfStale);
      window.removeEventListener("pageshow", refreshIfStale);
    };
  }, [router]);

  return null;
}
