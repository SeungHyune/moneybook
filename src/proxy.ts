import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/supabase/env";

/**
 * Next.js 16 에서 middleware 는 proxy 로 이름이 바뀌었다.
 * 여기서 하는 일은 두 가지다.
 *  1. Supabase 세션 쿠키 갱신 (안 하면 로그인이 조용히 풀린다)
 *  2. 로그인하지 않은 사용자를 /login 으로 보내기
 */

/** 로그인 없이 접근 가능한 경로 */
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  "/invite",
  "/offline",
  "/manifest.json",
  "/sw.js",
  // 세션이 아니라 자체 시크릿으로 인증하는 API (Vercel Cron)
  "/api/cron",
  // 뷰포트 진단용 임시 페이지 (iOS 26 하단 갭 조사)
  "/debug",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const { url, key } = getSupabaseEnv();

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getClaims/getUser 를 반드시 호출해야 세션 쿠키가 갱신된다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublicPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // 로그인 후 원래 가려던 곳으로 돌려보내기 위해 저장
    loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // 이미 로그인했는데 /login 에 오면 홈으로
  if (user && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * 아래를 제외한 모든 경로에서 실행:
     * - _next/static, _next/image (빌드 산출물)
     * - icons/, fonts/ (public 정적 자산)
     * - favicon, manifest, 서비스워커
     * - 이미지/폰트/스타일 파일 확장자
     *
     * 정적 자산을 빼지 않으면 로그인 가드에 걸려 302 로 튕기고,
     * 폰트나 CSS 가 로그인 페이지 HTML 로 대체된다.
     */
    "/((?!_next/static|_next/image|favicon\\.ico|icons/|fonts/|manifest\\.json|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|woff2?|ttf|otf)$).*)",
  ],
};
