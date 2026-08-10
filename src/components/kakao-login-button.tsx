"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** 카카오 공식 심볼 */
function KakaoSymbol() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="currentColor"
      aria-hidden
    >
      <path d="M12 3C6.99 3 3 6.2 3 10.14c0 2.52 1.66 4.73 4.17 6L6.1 20.3c-.1.35.3.63.6.43l4.93-3.26c.12.01.25.01.37.01 5.01 0 9-3.2 9-7.34C21 6.2 17.01 3 12 3Z" />
    </svg>
  );
}

export function KakaoLoginButton({ next }: { next?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const callbackUrl = new URL("/auth/callback", window.location.origin);
      if (next) callbackUrl.searchParams.set("next", next);

      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: callbackUrl.toString(),
          /**
           * scopes 는 일부러 지정하지 않는다.
           * Supabase 는 이 값을 기본 scope 에 "덧붙이기만" 하고 덮어쓰지 않아서,
           * account_email 을 빼려고 지정해봐야 중복만 생긴다.
           *   실제 요청: account_email profile_image profile_nickname + 지정한 값
           *
           * 따라서 카카오 콘솔의 동의항목에 아래 세 개가 모두 설정돼 있어야 한다.
           * 하나라도 빠지면 KOE205 가 난다.
           *   - profile_nickname (닉네임)
           *   - profile_image    (프로필 사진)
           *   - account_email    (카카오계정 이메일) — 개인 앱은 "선택 동의"로 설정
           */
        },
      });

      if (signInError) throw signInError;
      // 성공하면 카카오로 이동하므로 여기서 로딩을 끄지 않는다
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "로그인 중 문제가 발생했습니다.",
      );
      setLoading(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      <button
        type="button"
        onClick={handleLogin}
        disabled={loading}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#FEE500] text-base font-bold text-[#191600] transition active:scale-[0.98] disabled:opacity-60"
      >
        <KakaoSymbol />
        {loading ? "카카오로 이동 중..." : "카카오로 시작하기"}
      </button>

      {error && (
        <p className="text-center text-sm text-expense" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
