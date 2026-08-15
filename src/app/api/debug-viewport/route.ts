import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 뷰포트 진단 수신 (임시).
 * 측정값을 진단 테이블에 쌓는다 — 배포가 바뀌어도 조회할 수 있다.
 * 원인이 확정되면 비콘·이 라우트·테이블을 함께 지운다.
 */

let tableReady = false;

export async function POST(request: Request) {
  try {
    const body = await request.text();
    if (body.length > 2000) return NextResponse.json({ ok: false });

    // JSON 인지 확인 (아니면 버린다)
    JSON.parse(body);

    if (!tableReady) {
      await prisma.$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS viewport_diag (
          id serial PRIMARY KEY,
          at timestamptz DEFAULT now(),
          data jsonb
        )`,
      );
      await prisma.$executeRawUnsafe(
        `ALTER TABLE viewport_diag ENABLE ROW LEVEL SECURITY`,
      );
      tableReady = true;
    }

    await prisma.$executeRaw`INSERT INTO viewport_diag (data) VALUES (${body}::jsonb)`;
  } catch {
    // 진단용 — 실패는 조용히
  }
  return NextResponse.json({ ok: true });
}
