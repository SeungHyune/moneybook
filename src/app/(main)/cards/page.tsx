import Link from "next/link";
import { Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { requireHouseholdContext } from "@/lib/auth";
import { getCardBillings, getFormOptions, getTotalAssets } from "@/lib/queries";
import { ACCOUNT_TYPE_LABEL, CARD_TYPE_LABEL } from "@/lib/labels";
import { formatWon, toYearMonth } from "@/lib/utils";

export const metadata = { title: "카드/자산" };

export default async function CardsPage({ searchParams }: PageProps<"/cards">) {
  const { household } = await requireHouseholdContext();
  const params = await searchParams;

  const monthParam = params.month;
  const yearMonth =
    typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
      ? monthParam
      : toYearMonth(new Date());

  const [billings, options, totalAssets] = await Promise.all([
    getCardBillings(household.id, yearMonth),
    getFormOptions(household.id),
    getTotalAssets(household.id),
  ]);

  const totalBilling = billings.reduce((sum, item) => sum + item.total, 0);

  return (
    <>
      <AppHeader
        title="카드 / 자산"
        action={
          <Link
            href="/cards/new"
            aria-label="추가"
            className="flex size-9 items-center justify-center rounded-full text-primary transition active:bg-surface-muted"
          >
            <Plus className="size-5" />
          </Link>
        }
      />

      <div className="space-y-4 px-4 py-4">
        <MonthSwitcher yearMonth={yearMonth} />

        <section className="rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">총 자산</span>
            <span className="tabular text-lg font-bold">
              {formatWon(totalAssets)}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2">
            <span className="text-sm text-muted">
              {Number(yearMonth.split("-")[1])}월 카드 청구 예정
            </span>
            <span className="tabular text-lg font-bold text-expense">
              {formatWon(totalBilling)}
            </span>
          </div>
        </section>

        {/* 카드 */}
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold">카드</h2>

          {billings.length === 0 ? (
            <EmptyBox
              message="등록된 카드가 없어요."
              actionLabel="카드 등록하기"
              href="/cards/new"
            />
          ) : (
            <ul className="space-y-2">
              {billings.map(({ card, total, lumpSum, installment, period, ongoingInstallments }) => (
                <li
                  key={card.id}
                  className="overflow-hidden rounded-2xl border border-border bg-surface"
                >
                  <div
                    className="flex items-center gap-3 p-4"
                    style={{
                      background: `linear-gradient(135deg, ${card.color}14, transparent)`,
                    }}
                  >
                    <span
                      className="h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: card.color }}
                      aria-hidden
                    />

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">
                        {card.issuer ? `${card.issuer} ` : ""}
                        {card.name}
                      </p>
                      <p className="text-xs text-muted">
                        {CARD_TYPE_LABEL[card.type]}
                        {card.last4 && ` · ${card.last4}`}
                        {card.billingDay && ` · 매월 ${card.billingDay}일 결제`}
                        {card.ownerMember?.displayName &&
                          ` · ${card.ownerMember.displayName}`}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <p className="tabular text-sm font-bold">
                        {formatWon(total)}
                      </p>
                      {period && (
                        <p className="text-[10px] text-muted">
                          {period.periodStart.getMonth() + 1}/
                          {period.periodStart.getDate()} ~{" "}
                          {period.periodEnd.getMonth() + 1}/
                          {period.periodEnd.getDate()}
                        </p>
                      )}
                    </div>
                  </div>

                  {total > 0 && (
                    <div className="grid grid-cols-2 gap-px border-t border-border bg-border">
                      <div className="bg-surface px-4 py-2.5">
                        <p className="text-[11px] text-muted">일시불</p>
                        <p className="tabular text-sm font-medium">
                          {formatWon(lumpSum)}
                        </p>
                      </div>
                      <div className="bg-surface px-4 py-2.5">
                        <p className="text-[11px] text-muted">할부</p>
                        <p className="tabular text-sm font-medium">
                          {formatWon(installment)}
                        </p>
                      </div>
                    </div>
                  )}

                  {ongoingInstallments.length > 0 && (
                    <ul className="space-y-1.5 border-t border-border px-4 py-3">
                      {ongoingInstallments.map((plan) => (
                        <li
                          key={plan.id}
                          className="flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="min-w-0 truncate text-muted">
                            {plan.merchant}
                          </span>
                          <span className="shrink-0 text-muted">
                            {plan.round}/{plan.totalRounds}회차
                          </span>
                          <span className="tabular shrink-0 font-medium">
                            {formatWon(plan.amount)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 계좌 */}
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold">계좌</h2>

          {options.accounts.length === 0 ? (
            <EmptyBox
              message="등록된 계좌가 없어요."
              actionLabel="계좌 등록하기"
              href="/cards/new?tab=account"
            />
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
              {options.accounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center gap-3 py-3.5"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: account.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {account.bankName ? `${account.bankName} ` : ""}
                      {account.name}
                    </p>
                    <p className="text-xs text-muted">
                      {ACCOUNT_TYPE_LABEL[account.type as keyof typeof ACCOUNT_TYPE_LABEL]}
                    </p>
                  </div>
                  <span
                    className={`tabular text-sm font-bold ${
                      account.balance < 0 ? "text-expense" : ""
                    }`}
                  >
                    {formatWon(account.balance)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function EmptyBox({
  message,
  actionLabel,
  href,
}: {
  message: string;
  actionLabel: string;
  href: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface py-8 text-center">
      <p className="text-sm text-muted">{message}</p>
      <Link
        href={href}
        className="mt-2 inline-block text-sm font-medium text-primary"
      >
        {actionLabel}
      </Link>
    </div>
  );
}
