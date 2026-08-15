"use client";

import { useEffect } from "react";

/**
 * (임시) iOS 26 하단 갭 진단 비콘.
 * 홈 화면 앱에서만, 세션당 한 번 뷰포트 실측값을 서버 로그로 보낸다.
 * 원인이 확정되면 이 함수와 /api/debug-viewport 를 함께 지운다.
 */
function sendViewportBeacon() {
  try {
    if (!matchMedia("(display-mode: standalone)").matches) return;

    const probe = (height: string) => {
      const el = document.createElement("div");
      el.style.cssText = `position:fixed;top:0;left:0;width:1px;height:${height};visibility:hidden`;
      document.body.appendChild(el);
      const value = Math.round(el.getBoundingClientRect().height);
      el.remove();
      return value;
    };

    // env(safe-area-inset-*) 실값
    const safeProbe = document.createElement("div");
    safeProbe.style.cssText =
      "position:fixed;top:env(safe-area-inset-top);bottom:env(safe-area-inset-bottom);left:0;width:1px;visibility:hidden";
    document.body.appendChild(safeProbe);
    const rect = safeProbe.getBoundingClientRect();
    const safeTop = Math.round(rect.top);
    const safeBottom = Math.round(window.innerHeight - rect.bottom);
    safeProbe.remove();

    const payload = JSON.stringify({
      t: new Date().toISOString(),
      screenH: screen.height,
      innerH: window.innerHeight,
      clientH: document.documentElement.clientHeight,
      vvH: Math.round(window.visualViewport?.height ?? -1),
      vvTop: Math.round(window.visualViewport?.offsetTop ?? -1),
      vh: probe("100vh"),
      dvh: probe("100dvh"),
      svh: probe("100svh"),
      lvh: probe("100lvh"),
      safeTop,
      safeBottom,
      docScrollH: document.documentElement.scrollHeight,
      bodyH: Math.round(document.body.getBoundingClientRect().height),
      dpr: window.devicePixelRatio,
      ua: navigator.userAgent.slice(0, 90),
    });

    navigator.sendBeacon("/api/debug-viewport", payload);
  } catch {
    // 진단용 — 실패해도 앱에는 영향 없음
  }
}

/**
 * 서비스워커 등록.
 * 라이브러리 대신 public/sw.js 를 직접 쓴다 —
 * Next 16 의 Turbopack 과 충돌하지 않고, 캐시 전략도 눈으로 확인 가능하다.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    // 레이아웃이 안정된 뒤 측정
    const timer = setTimeout(sendViewportBeacon, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch((error) => {
        console.error("[pwa] 서비스워커 등록 실패", error);
      });
    };

    // 첫 페인트를 방해하지 않도록 load 이후에 등록
    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
