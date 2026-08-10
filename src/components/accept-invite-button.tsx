"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptInvite } from "@/app/actions/household";
import { Button } from "@/components/ui/button";

export function AcceptInviteButton({ code }: { code: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setLoading(true);
    setError(null);

    const result = await acceptInvite(code);

    if (result && "error" in result && result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <div className="w-full space-y-3">
      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={handleAccept}
        disabled={loading}
      >
        {loading ? "합류하는 중..." : "합류하기"}
      </Button>

      {error && (
        <p className="text-sm text-expense" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
