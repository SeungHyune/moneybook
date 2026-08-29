import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { CardStatementActions } from "@/components/card-statement-actions";
import { MemberFilter } from "@/components/member-filter";
import { getMemberFilter } from "@/lib/member-filter";
import { canManageAsset, requireHouseholdContext } from "@/lib/auth";
import {
  getAssetSummary,
  getCardBillings,
  getFormOptions,
  getHouseholdMembers,
  getUpcomingCardPayments,
} from "@/lib/queries";
import { ACCOUNT_TYPE_LABEL, CARD_TYPE_LABEL } from "@/lib/labels";
import { formatWon, toYearMonth } from "@/lib/utils";

export const metadata = { title: "카드/자산" };

export default async function CardsPage({ searchParams }: PageProps<"/cards">) {
  const { household, member } = await requireHouseholdContext();
  const params = await searchParams;

  // 수정 권한이 없는 항목에 직접 접근했을 때 돌아오는 표시
  const forbidden = params.error === "forbidden";

  /*
   * 이 화면은 "지금" 상태를 보는 곳이다 — 잔액은 현재값이고 신용카드는
   * 다음 결제일 기준이라 월을 바꿔도 대부분 그대로였다. 그래서 월 선택기를
   * 없앴고, 체크카드 사용액만 이번 달 기준으로 계산한다.
   * 월별로 보려면 카드/계좌를 눌러 상세로 들어가면 된다.
   */
  const yearMonth = toYearMonth(new Date());

  const [filterMember, members] = await Promise.all([
    getMemberFilter(household.id),
    getHouseholdMembers(household.id),
  ]);
  const memberId = filterMember?.id ?? null;

  const [billings, upcomingPayments, options, assets] = await Promise.all([
    getCardBillings(household.id, yearMonth, memberId),
    // 신용카드는 "고른 달"이 아니라 "다음 결제일" 기준으로 보여준다
    getUpcomingCardPayments(household.id, memberId),
    getFormOptions(household.id),
    getAssetSummary(household.id, memberId),
  ]);

  // 구성원 보기일 땐 그 사람 소유 계좌만
  const visibleAccounts = memberId
    ? options.accounts.filter((account) => account.ownerMemberId === memberId)
    : options.accounts;

  const upcomingByCard = new Map(
    upcomingPayments.map((item) => [item.card.id, item]),
  );

  // 체크카드는 카드에 잔액이 있는 게 아니라 연결 통장에 있다 — 그걸 같이 보여준다
  const balanceByAccount = new Map(
    options.accounts.map((account) => [account.id, account.balance]),
  );

  const totalUpcoming = upcomingPayments
    .filter((item) => !item.statement?.isPaid)
    .reduce((sum, item) => sum + item.total, 0);

  return (
    <>
      <AppHeader
        title={
          <MemberFilter
            householdName="카드 / 자산"
            members={members}
            selectedId={memberId}
          />
        }
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
        {forbidden && (
          <p
            className="rounded-xl bg-expense/10 px-4 py-3 text-center text-sm text-expense"
            role="alert"
          >
            본인이 등록한 항목만 수정할 수 있어요.
          </p>
        )}

        {/* 가진 돈 / 갚을 돈을 나눠서 본다 */}
        <section className="space-y-3 rounded-2xl border border-border bg-surface p-4">
          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold">가진 돈</span>
              <span className="tabular text-lg font-bold">
                {formatWon(assets.total)}
              </span>
            </div>

            <ul className="mt-2 space-y-1">
              {[
                { label: "현금", value: assets.cash },
                { label: "입출금", value: assets.checking },
                { label: "예적금", value: assets.savings },
                { label: "투자", value: assets.investment },
                { label: "기타", value: assets.other },
              ]
                .filter((row) => row.value !== 0)
                .map((row) => (
                  <li
                    key={row.label}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-muted">{row.label}</span>
                    <span className="tabular">{formatWon(row.value)}</span>
                  </li>
                ))}
            </ul>
          </div>

          {/*
            카드마다 결제일이 달라서 합계만 보면 "언제 나가는 돈인지" 알 수 없다.
            그래서 카드별로 날짜와 금액을 함께 적는다.
          */}
          <div className="border-t border-border pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold">갚을 돈</span>
              <span className="tabular text-lg font-bold text-expense">
                {formatWon(totalUpcoming + assets.loanDebt)}
              </span>
            </div>
            <p className="mt-0.5 text-[11px] text-muted">
              카드별 다음 결제 예정액의 합계예요
            </p>

            <ul className="mt-2 space-y-1">
              {upcomingPayments
                .filter((item) => item.total > 0 && !item.statement?.isPaid)
                .sort((a, b) => a.dday - b.dday)
                .map((item) => (
                  <li
                    key={item.card.id}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <span className="min-w-0 truncate text-muted">
                      {item.period.billingDate.getMonth() + 1}/
                      {item.period.billingDate.getDate()} · {item.card.name}
                      {item.dday >= 0 && item.dday <= 3 && (
                        <span className="ml-1 text-expense">D-{item.dday}</span>
                      )}
                    </span>
                    <span className="tabular shrink-0">
                      {formatWon(item.total)}
                    </span>
                  </li>
                ))}

              {assets.loanDebt > 0 && (
                <li className="flex items-center justify-between text-xs">
                  <span className="text-muted">대출 잔액</span>
                  <span className="tabular">{formatWon(assets.loanDebt)}</span>
                </li>
              )}
            </ul>
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
              {billings.map((item) => {
                const { card, ongoingInstallments, isCredit, monthlyUsage } = item;

                /*
                 * 신용카드는 고른 달이 아니라 "아직 오지 않은 결제일" 기준으로 본다.
                 * 오늘이 8/13 이고 결제일이 5일이면 8/5 는 지났으니 9/5 를 가리키고,
                 * 이용기간도 그 9/5 기준(7/22~8/21)이 된다.
                 */
                const upcoming = isCredit ? upcomingByCard.get(card.id) : undefined;
                const period = upcoming?.period ?? null;
                const total = upcoming?.total ?? 0;
                const lumpSum = upcoming?.lumpSum ?? 0;
                const installment = upcoming?.installment ?? 0;
                const statement = upcoming?.statement ?? null;

                return (
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

                    {/* 누르면 이 카드의 내역만 보는 상세로 */}
                    <Link
                      href={`/cards/${card.id}`}
                      className="min-w-0 flex-1 active:opacity-70"
                    >
                      <p className="truncate text-sm font-bold">
                        {card.ownerMember?.displayName && (
                          <span className="text-muted">
                            {card.ownerMember.displayName} ·{" "}
                          </span>
                        )}
                        {card.issuer ? `${card.issuer} ` : ""}
                        {card.name}
                      </p>
                      <p className="text-xs text-muted">
                        {CARD_TYPE_LABEL[card.type]}
                        {card.last4 && ` · ${card.last4}`}
                        {isCredit && card.billingDay
                          ? ` · 매월 ${card.billingDay}일 결제`
                          : null}
                        {/* 체크카드는 결제일 대신 어느 통장에서 빠지는지가 중요하다 */}
                        {!isCredit && card.paymentAccount
                          ? ` · ${card.paymentAccount.name}에서 즉시출금`
                          : null}
                        {!isCredit && !card.paymentAccount
                          ? " · 통장 미연결"
                          : null}
                      </p>
                    </Link>

                    <div className="flex shrink-0 items-center gap-1">
                      <div className="text-right">
                        {/* 신용카드는 청구 예정액, 체크·선불카드는 그 달 사용액 */}
                        <p className="tabular text-sm font-bold">
                          {formatWon(isCredit ? total : monthlyUsage)}
                        </p>
                        {isCredit && period ? (
                          <>
                            <p className="text-[10px] text-muted">
                              {period.billingDate.getMonth() + 1}/
                              {period.billingDate.getDate()} 결제
                              {upcoming && upcoming.dday >= 0
                                ? ` · D-${upcoming.dday}`
                                : ""}
                            </p>
                            <p className="text-[10px] text-muted">
                              {period.periodStart.getMonth() + 1}/
                              {period.periodStart.getDate()} ~{" "}
                              {period.periodEnd.getMonth() + 1}/
                              {period.periodEnd.getDate()} 사용분
                            </p>
                          </>
                        ) : (
                          <p className="text-[10px] text-muted">
                            이번 달 쓴 금액
                          </p>
                        )}
                      </div>

                      {canManageAsset(member, card) && (
                        <Link
                          href={`/cards/${card.id}/edit`}
                          aria-label={`${card.name} 수정`}
                          className="flex size-8 items-center justify-center rounded-full text-muted transition active:bg-surface-muted"
                        >
                          <Pencil className="size-4" />
                        </Link>
                      )}
                    </div>
                  </div>

                  {/* 체크카드: 연결 통장에 남은 돈 (카드 잔액이 아니라는 걸 분명히) */}
                  {!isCredit && card.paymentAccountId && (
                    <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
                      <span className="text-[11px] text-muted">
                        {card.paymentAccount?.name ?? "연결 통장"}에 남은 돈
                      </span>
                      <span className="tabular text-sm font-medium">
                        {formatWon(
                          balanceByAccount.get(card.paymentAccountId) ?? 0,
                        )}
                      </span>
                    </div>
                  )}

                  {isCredit && total > 0 && (
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

                  {/*
                    결제일에 통장에서 빠지는 처리 (신용카드만).
                    대상은 고른 달이 아니라 다음 결제 예정월이다.
                  */}
                  {isCredit && period && (total > 0 || statement?.isPaid) && (
                    <CardStatementActions
                      cardId={card.id}
                      yearMonth={period.yearMonth}
                      amount={total}
                      accountName={card.paymentAccount?.name ?? null}
                      hasAccount={Boolean(card.paymentAccountId)}
                      isPaid={Boolean(statement?.isPaid)}
                      paidAmount={statement?.totalAmount ?? null}
                      canUndo={upcoming?.canUndo ?? true}
                      isOverdue={upcoming?.isOverdue ?? false}
                    />
                  )}
                </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* 계좌 */}
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold">계좌</h2>

          {visibleAccounts.length === 0 ? (
            <EmptyBox
              message="등록된 계좌가 없어요."
              actionLabel="계좌 등록하기"
              href="/cards/new?tab=account"
            />
          ) : (
            <ul className="divide-y divide-border rounded-2xl border border-border bg-surface px-4">
              {visibleAccounts.map((account) => (
                <li
                  key={account.id}
                  className="flex items-center gap-3 py-3.5"
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: account.color }}
                    aria-hidden
                  />
                  {/* 누르면 이 계좌의 입출금 내역 상세로 */}
                  <Link
                    href={`/accounts/${account.id}`}
                    className="min-w-0 flex-1 active:opacity-70"
                  >
                    <p className="truncate text-sm font-medium">
                      {account.ownerMember?.displayName && (
                        <span className="text-muted">
                          {account.ownerMember.displayName} ·{" "}
                        </span>
                      )}
                      {account.bankName ? `${account.bankName} ` : ""}
                      {account.name}
                    </p>
                    <p className="text-xs text-muted">
                      {ACCOUNT_TYPE_LABEL[account.type as keyof typeof ACCOUNT_TYPE_LABEL]}
                    </p>
                  </Link>
                  <span
                    className={`tabular shrink-0 text-sm font-bold ${
                      account.balance < 0 ? "text-expense" : ""
                    }`}
                  >
                    {formatWon(account.balance)}
                  </span>

                  {canManageAsset(member, account) && (
                    <Link
                      href={`/accounts/${account.id}/edit`}
                      aria-label={`${account.name} 수정`}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted transition active:bg-surface-muted"
                    >
                      <Pencil className="size-4" />
                    </Link>
                  )}
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
