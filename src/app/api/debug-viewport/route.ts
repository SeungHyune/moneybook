import { NextResponse } from "next/server";

/**
 * 뷰포트 진단 수신 (임시).
 * 클라이언트가 보낸 측정값을 서버 로그로 남긴다 — `vercel logs` 로 읽는다.
 * iOS 26 하단 갭 원인이 확정되면 비콘과 함께 지운다.
 */
export async function POST(request: Request) {
  try {
    const body = await request.text();
    // 로그 줄이 잘리지 않게 한 줄 JSON 으로
    console.log(`[viewport-debug] ${body.slice(0, 1500)}`);
  } catch {
    // 진단용이므로 실패는 조용히 무시
  }
  return NextResponse.json({ ok: true });
}
