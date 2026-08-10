import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * 카카오 로그인 후 돌아오는 곳.
 * Supabase 가 붙여준 code 를 세션으로 바꾼다.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  const errorDescription = searchParams.get("error_description");

  // 사용자가 카카오 동의 화면에서 취소한 경우
  if (errorDescription) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(errorDescription)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  // 오픈 리다이렉트 방지: 내부 경로만 허용
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // 프록시(Vercel 등) 뒤에 있으면 원래 호스트로 되돌려준다
  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocal = process.env.NODE_ENV === "development";

  if (!isLocal && forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${safeNext}`);
  }

  return NextResponse.redirect(`${origin}${safeNext}`);
}
