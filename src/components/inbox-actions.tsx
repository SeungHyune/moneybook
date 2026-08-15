"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste } from "lucide-react";
import { discardInboxItem, ingestPastedText } from "@/app/actions/ingest";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";

export function DiscardInboxButton({ inboxId }: { inboxId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      size="sm"
      variant="ghost"
      className="h-9"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await discardInboxItem(inboxId);
        })
      }
    >
      버리기
    </Button>
  );
}

/** 자동화 없이도 쓸 수 있게 — 알림/문자 내용을 직접 붙여넣는 입구 */
export function PasteIngestForm() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface py-3 text-sm font-medium text-muted active:bg-surface-muted"
      >
        <ClipboardPaste className="size-4" />
        알림 내용 붙여넣기
      </button>
    );
  }

  function submit() {
    startTransition(async () => {
      setError(null);
      const result = await ingestPastedText(text);
      if (result.error) {
        setError(result.error);
        return;
      }
      setText("");
      setIsOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
      <Textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={"카드 알림이나 문자 내용을 그대로 붙여넣으세요.\n예: 신한카드(1234)승인 3,500원 일시불 08/13 스타벅스"}
        className="min-h-24"
        autoFocus
      />

      {error && (
        <p className="text-xs text-expense" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="flex-1"
          onClick={submit}
          disabled={isPending || text.trim().length < 5}
        >
          {isPending ? "분석 중..." : "분석하기"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIsOpen(false)}
        >
          취소
        </Button>
      </div>
    </div>
  );
}
