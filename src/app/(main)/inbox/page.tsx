import Link from "next/link";
import { ChevronLeft, Inbox } from "lucide-react";
import { DiscardInboxButton, PasteIngestForm } from "@/components/inbox-actions";
import { InboxPoller } from "@/components/inbox-poller";
import { ReceiptUpload } from "@/components/receipt-upload";
import { Loader2 } from "lucide-react";
import { requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatRelativeDate, formatWon } from "@/lib/utils";
import { installmentLabel } from "@/lib/labels";

export const metadata = { title: "자동 수집함" };

/**
 * 자동 수집 수신함.
 * 카드 매칭에 실패했거나 취소 건이라 자동 등록되지 않은 것들을 확인한다.
 */
export default async function InboxPage() {
  const { user } = await requireHouseholdContext();

  const [items, recentConfirmed] = await Promise.all([
    prisma.ingestInbox.findMany({
      // 분석 중·확인 대기·실패를 함께 보여준다
      where: { userId: user.id, status: { in: ["QUEUED", "PENDING", "FAILED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.ingestInbox.findMany({
      where: { userId: user.id, status: "CONFIRMED" },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const queued = items.filter((item) => item.status === "QUEUED");
  const failed = items.filter((item) => item.status === "FAILED");
  const pending = items.filter((item) => item.status === "PENDING");

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="flex h-14 items-center gap-1 px-2">
          <Link
            href="/"
            aria-label="뒤로"
            className="flex size-9 items-center justify-center rounded-full text-muted active:bg-surface-muted"
          >
            <ChevronLeft className="size-5" />
          </Link>
          <h1 className="text-base font-bold">자동 수집함</h1>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        {/* 분석 중인 항목이 있으면 몇 초마다 자동 갱신 */}
        <InboxPoller active={queued.length > 0} />

        <ReceiptUpload />
        <PasteIngestForm />

        {/* 백그라운드 분석 진행 중 */}
        {queued.length > 0 && (
          <ul className="space-y-2">
            {queued.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-dashed border-border bg-surface p-4"
              >
                <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">이미지를 읽고 있어요...</p>
                  <p className="text-xs text-muted">
                    끝나면 여기에 결과가 나타나요
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* 분석 실패 */}
        {failed.length > 0 && (
          <ul className="space-y-2">
            {failed.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-3 rounded-2xl border border-expense/30 bg-expense/5 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-expense">
                    {item.rawText.replace(/^📷\s*(실패:)?\s*/, "")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    더 밝고 또렷하게 다시 올려 보세요
                  </p>
                </div>
                <DiscardInboxButton inboxId={item.id} />
              </li>
            ))}
          </ul>
        )}

        {pending.length === 0 && queued.length === 0 && failed.length === 0 ? (
          <div className="rounded-2xl border border-border bg-surface px-6 py-10 text-center">
            <Inbox className="mx-auto size-8 text-muted" />
            <p className="mt-3 text-sm font-medium">확인할 항목이 없어요</p>
            <p className="mt-1 text-xs leading-relaxed text-muted">
              카드가 매칭되면 자동으로 등록되고,
              <br />
              애매한 것만 여기로 와요.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {pending.map((item) => {
              // 확인 화면으로 파싱 결과를 넘긴다
              const query = new URLSearchParams({ inbox: item.id });

              return (
                <li
                  key={item.id}
                  className="space-y-2 rounded-2xl border border-border bg-surface p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {item.merchant ?? "가맹점 미확인"}
                        {item.isCancel && (
                          <span className="ml-1.5 rounded-md bg-expense/15 px-1.5 py-0.5 text-[10px] font-medium text-expense">
                            취소건
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        {item.occurredAt
                          ? formatRelativeDate(item.occurredAt)
                          : "날짜 미확인"}
                        {item.cardLast4 &&
                          ` · 카드 ${item.cardLast4}${item.cardId ? "" : " (미등록)"}`}
                        {item.installmentMonths > 1 &&
                          ` · ${installmentLabel(item.installmentMonths)}`}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-sm font-bold">
                      {item.amount !== null ? formatWon(item.amount) : "—"}
                    </span>
                  </div>

                  <p className="line-clamp-2 rounded-lg bg-surface-muted px-2.5 py-1.5 text-[11px] leading-relaxed text-muted">
                    {item.rawText}
                  </p>

                  <div className="flex gap-2">
                    <Link
                      href={`/transactions/new?${query.toString()}`}
                      className="flex h-9 flex-1 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground active:brightness-95"
                    >
                      확인하고 등록
                    </Link>
                    <DiscardInboxButton inboxId={item.id} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {recentConfirmed.length > 0 && (
          <section className="rounded-2xl border border-border bg-surface p-4">
            <h2 className="mb-2 text-xs font-bold text-muted">
              최근 자동 등록됨
            </h2>
            <ul className="divide-y divide-border">
              {recentConfirmed.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 py-2 text-xs first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 truncate text-muted">
                    {item.merchant ?? "—"}
                  </span>
                  <span className="tabular shrink-0 font-medium">
                    {item.amount !== null ? formatWon(item.amount) : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
