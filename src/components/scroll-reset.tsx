"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

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
  }, [pathname]);

  return null;
}
