"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * (임시) iOS 26 하단 갭 진단 비콘.
 * 홈 화면 앱에서 페이지를 옮길 때마다 실측값을 서버(DB)로 보낸다.
 * 핵심 지표는 navGap — 하단 탭의 바닥과 화면 바닥 사이 실제 간격이다.
 * 원인이 확정되면 이 파일의 비콘과 /api/debug-viewport 를 함께 지운다.
 */
function sendViewportBeacon(path: string) {
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

    const shell = document.querySelector(".app-shell");
    const nav = document.querySelector("nav");
    const navRect = nav?.getBoundingClientRect();

    const payload = JSON.stringify({
      path,
      innerH: window.innerHeight,
      vvH: Math.round(window.visualViewport?.height ?? -1),
      dvh: probe("100dvh"),
      svh: probe("100svh"),
      lvh: probe("100lvh"),
      screenH: screen.height,
      docH: Math.round(document.documentElement.scrollHeight),
      shellH: Math.round(shell?.getBoundingClientRect().height ?? -1),
      navBottom: Math.round(navRect?.bottom ?? -1),
      /** 하단 탭 바닥 ~ 뷰포트 바닥 간격. 0 근처가 정상 */
      navGap: navRect ? Math.round(window.innerHeight - navRect.bottom) : null,
      scrollY: Math.round(window.scrollY),
      dpr: window.devicePixelRatio,
    });

    navigator.sendBeacon("/api/debug-viewport", payload);
  } catch {
    // 진단용 — 실패해도 앱에는 영향 없음
  }
}

/**
 * 페이지(경로) 전환 시 스크롤을 즉시 맨 위로.
 *
 * iOS 26 홈 화면 앱에서, 스크롤이 내려간 상태로 전환하면 짧은 스켈레톤이
 * 이전 스크롤 위치를 물려받아 위로 밀리고, 그 순간 WebKit 이 하단에 유령
 * 갭을 만든 채 회수하지 못하는 버그가 있다. 전환 즉시 스크롤을 0 으로
 * 되돌려 그 트리거 자체를 막는다.
 *
 * 경로가 같고 쿼리만 바뀌는 경우(월 이동, 필터)는 건드리지 않는다.
 */
export function ScrollReset() {
  const pathname = usePathname();

  useEffect(() => {
    // 문서 스크롤 (모바일)
    window.scrollTo(0, 0);
    // 폰 프레임 내부 스크롤 (데스크톱)
    document.querySelector(".app-shell")?.scrollTo(0, 0);

    // 레이아웃이 자리잡은 뒤 측정해서 보고
    const timer = setTimeout(() => sendViewportBeacon(pathname), 1200);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
