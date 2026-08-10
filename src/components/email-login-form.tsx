"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";

/**
 * 이메일 + 비밀번호 로그인.
 *
 * 카카오가 막혔을 때(동의 철회, 카카오 장애, 테스트용 계정 등) 쓰는 보조 수단이다.
 * 가입 폼은 일부러 만들지 않았다 — 계정은 Supabase 대시보드에서만 만든다.
 */
export function EmailLoginForm({ next }: { next?: string }) {
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      // Supabase 메시지가 영어라 자주 나오는 것만 우리말로 바꿔준다
      setError(
        signInError.message.includes("Invalid login credentials")
          ? "이메일 또는 비밀번호가 맞지 않아요."
          : signInError.message,
      );
      setLoading(false);
      return;
    }

    // 서버 컴포넌트가 새 세션을 읽도록 refresh 까지 해준다
    router.push(next && next.startsWith("/") ? next : "/");
    router.refresh();
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full py-2 text-center text-sm text-muted underline underline-offset-4"
      >
        이메일로 로그인
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 text-left">
      <Field label="이메일">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="admin@example.com"
          autoComplete="email"
          required
        />
      </Field>

      <Field label="비밀번호">
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </Field>

      {error && (
        <p className="text-sm text-expense" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        {loading ? "로그인 중..." : "로그인"}
      </Button>

      <button
        type="button"
        onClick={() => setIsOpen(false)}
        className="w-full py-1 text-center text-sm text-muted"
      >
        취소
      </button>
    </form>
  );
}
