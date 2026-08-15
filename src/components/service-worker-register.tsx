"use client";

import { useEffect } from "react";

/**
 * 서비스워커 등록.
 * 라이브러리 대신 public/sw.js 를 직접 쓴다 —
 * Next 16 의 Turbopack 과 충돌하지 않고, 캐시 전략도 눈으로 확인 가능하다.
 */
export function ServiceWorkerRegister() {
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
