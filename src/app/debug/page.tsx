"use client";

/**
 * 뷰포트 진단 페이지 (임시).
 * iOS 26 홈 화면 앱의 하단 갭 문제를 실측하기 위한 것.
 * 원인이 확정되면 지운다.
 */
import { useEffect, useState } from "react";

type Metrics = Record<string, string | number>;

export default function DebugPage() {
  const [metrics, setMetrics] = useState<Metrics>({});

  useEffect(() => {
    function measure() {
      const style = getComputedStyle(document.documentElement);

      const probe = (height: string) => {
        const el = document.createElement("div");
        el.style.cssText = `position:fixed;top:0;left:0;width:1px;height:${height};visibility:hidden;pointer-events:none`;
        document.body.appendChild(el);
        const value = el.getBoundingClientRect().height;
        el.remove();
        return Math.round(value);
      };

      setMetrics({
        "screen.height": screen.height,
        "screen.width": screen.width,
        devicePixelRatio: window.devicePixelRatio,
        innerHeight: window.innerHeight,
        outerHeight: window.outerHeight,
        "html.clientHeight": document.documentElement.clientHeight,
        "visualViewport.height": Math.round(window.visualViewport?.height ?? -1),
        "visualViewport.offsetTop": Math.round(
          window.visualViewport?.offsetTop ?? -1,
        ),
        "100vh": probe("100vh"),
        "100dvh": probe("100dvh"),
        "100svh": probe("100svh"),
        "100lvh": probe("100lvh"),
        "safe-top": style.getPropertyValue("--safe-top").trim() || "(없음)",
        "safe-bottom": style.getPropertyValue("--safe-bottom").trim() || "(없음)",
        standalone: String(matchMedia("(display-mode: standalone)").matches),
        "navigator.standalone": String(
          (navigator as { standalone?: boolean }).standalone ?? "n/a",
        ),
        UA: navigator.userAgent.slice(0, 80),
      });
    }

    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  return (
    <div style={{ fontFamily: "monospace", fontSize: 13, padding: 16 }}>
      <h1 style={{ fontWeight: 700, marginBottom: 12 }}>뷰포트 진단</h1>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {Object.entries(metrics).map(([key, value]) => (
            <tr key={key} style={{ borderBottom: "1px solid #8884" }}>
              <td style={{ padding: "4px 8px 4px 0", opacity: 0.6 }}>{key}</td>
              <td style={{ padding: "4px 0", fontWeight: 700 }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/*
        시각 마커:
        - 빨간 테두리 = position: fixed; inset: 0 이 닿는 범위
        - 파란 줄     = fixed bottom: 0
        - 초록 줄     = fixed bottom: env(safe-area-inset-bottom)
        화면 바닥과 이 선들 사이가 벌어져 있으면 그만큼이 버그 구간이다.
      */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          border: "3px solid red",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: 6,
          background: "blue",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "fixed",
          bottom: "env(safe-area-inset-bottom)",
          left: 0,
          right: 0,
          height: 6,
          background: "limegreen",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
