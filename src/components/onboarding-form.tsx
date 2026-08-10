"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createHousehold } from "@/app/actions/household";
import { acceptInvite } from "@/app/actions/household";
import { Field, Input } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";

export function OnboardingForm({ nickname }: { nickname: string }) {
  const [mode, setMode] = useState<"create" | "join">("create");

  return (
    <main
      className="w-full px-6 pb-10"
      style={{ paddingTop: "calc(3rem + var(--safe-top))" }}
    >
      <div className="space-y-2 text-center">
        <p className="text-4xl">👋</p>
        <h1 className="text-xl font-bold">
          {nickname}님, 환영해요!
        </h1>
        <p className="text-sm leading-relaxed text-muted">
          가계부를 새로 만들거나
          <br />
          받은 초대 코드로 합류할 수 있어요.
        </p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-1 rounded-xl bg-surface-muted p-1">
        {(["create", "join"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setMode(value)}
            className={cn(
              "rounded-lg py-2.5 text-sm font-bold transition",
              mode === value ? "bg-surface text-foreground shadow-sm" : "text-muted",
            )}
          >
            {value === "create" ? "새로 만들기" : "초대 코드로 합류"}
          </button>
        ))}
      </div>

      {mode === "create" ? <CreateForm nickname={nickname} /> : <JoinForm />}
    </main>
  );
}

function CreateForm({ nickname }: { nickname: string }) {
  const [state, formAction] = useActionState(createHousehold, null);

  return (
    <form action={formAction} className="mt-6 space-y-5">
      <Field label="가계부 이름" hint="예: 우리집, 신혼부부 가계부">
        <Input
          name="name"
          required
          maxLength={30}
          defaultValue="우리집 가계부"
          autoComplete="off"
        />
      </Field>

      <Field label="내 표시 이름" hint="가계부 안에서 보일 이름이에요.">
        <Input
          name="displayName"
          maxLength={20}
          defaultValue={nickname}
          placeholder="예: 남편, 아내"
          autoComplete="off"
        />
      </Field>

      {state?.error && (
        <p
          className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense"
          role="alert"
        >
          {state.error}
        </p>
      )}

      <SubmitButton size="lg" className="w-full">
        가계부 만들기
      </SubmitButton>

      <p className="text-center text-xs leading-relaxed text-muted">
        기본 카테고리가 자동으로 만들어져요.
        <br />
        만든 뒤에 배우자를 초대할 수 있습니다.
      </p>
    </form>
  );
}

function JoinForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    if (!code.trim()) return;

    setLoading(true);
    setError(null);

    const result = await acceptInvite(code.trim().toUpperCase());

    if (result && "error" in result && result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="mt-6 space-y-5">
      <Field label="초대 코드" hint="배우자에게 받은 8자리 코드를 입력하세요.">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          maxLength={8}
          placeholder="ABCD2345"
          autoComplete="off"
          autoCapitalize="characters"
          className="tabular text-center text-lg tracking-[0.3em]"
        />
      </Field>

      {error && (
        <p
          className="rounded-xl bg-expense/10 px-4 py-3 text-sm text-expense"
          role="alert"
        >
          {error}
        </p>
      )}

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={handleJoin}
        disabled={loading || code.trim().length < 4}
      >
        {loading ? "합류하는 중..." : "합류하기"}
      </Button>
    </div>
  );
}
