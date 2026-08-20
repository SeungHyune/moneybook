"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * 분석 중(QUEUED)인 항목이 있는 동안 수신함을 몇 초마다 새로고침한다.
 * 백그라운드 큐가 끝나면 결과(PENDING/FAILED)가 자리를 대신하고,
 * QUEUED 가 사라지면 이 컴포넌트도 폴링을 멈춘다.
 */
export function InboxPoller({ active }: { active: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!active) return;

    const timer = setInterval(() => {
      router.refresh();
    }, 2500);

    return () => clearInterval(timer);
  }, [active, router]);

  return null;
}
