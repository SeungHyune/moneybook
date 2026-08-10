import { EmailLoginForm } from "@/components/email-login-form";
import { KakaoLoginButton } from "@/components/kakao-login-button";

export const metadata = {
  title: "로그인",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;

  const nextParam = params.next;
  const next = typeof nextParam === "string" ? nextParam : undefined;

  const errorParam = params.error;
  const error = typeof errorParam === "string" ? errorParam : undefined;

  return (
    <main className="flex min-h-full flex-1 flex-col justify-between px-6 pb-[calc(2rem+var(--safe-bottom))] pt-[calc(4rem+var(--safe-top))]">
      <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
        <div className="flex size-20 items-center justify-center rounded-3xl bg-primary text-4xl font-bold text-primary-foreground shadow-lg shadow-primary/25">
          ₩
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">우리집 가계부</h1>
          <p className="text-pretty text-sm leading-relaxed text-muted">
            고정지출부터 카드 할부까지,
            <br />
            둘이서 함께 관리하는 가계부
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {error && (
          <p
            className="rounded-xl bg-expense/10 px-4 py-3 text-center text-sm text-expense"
            role="alert"
          >
            로그인에 실패했어요. 다시 시도해 주세요.
          </p>
        )}

        <KakaoLoginButton next={next} />

        <EmailLoginForm next={next} />

        <p className="text-center text-xs leading-relaxed text-muted">
          로그인하면 서비스 이용약관과
          <br />
          개인정보 처리방침에 동의하는 것으로 간주합니다.
        </p>
      </div>
    </main>
  );
}
