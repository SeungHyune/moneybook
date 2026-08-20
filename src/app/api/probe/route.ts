import { NextResponse } from "next/server";

/**
 * (임시) 모듈 로드 프로브.
 * 서버 액션 모듈들이 런타임에서 정상 로드되는지 확인한다.
 * 원인 확정 후 즉시 삭제.
 */
export async function GET() {
  const results: Record<string, string> = {};

  for (const [name, loader] of Object.entries({
    "actions/transaction": () => import("@/app/actions/transaction"),
    "actions/recurring": () => import("@/app/actions/recurring"),
    "lib/push": () => import("@/lib/push"),
    "web-push": () => import("web-push"),
  })) {
    try {
      const mod = await loader();
      results[name] = `ok (${Object.keys(mod).length} exports)`;
    } catch (error) {
      results[name] =
        `FAIL: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`;
    }
  }

  return NextResponse.json(results);
}
