import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Pencil, Plus } from "lucide-react";
import { AssetDetail } from "@/components/asset-detail";
import { BillingSwitcher } from "@/components/billing-switcher";
import { CardStatementActions } from "@/components/card-statement-actions";
import { StatementTabs } from "@/components/statement-tabs";
import { canManageAsset, requireHouseholdContext } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getCardBillingOptions,
  getCardStatementDetail,
  getTransactions,
} from "@/lib/queries";
import { CARD_TYPE_LABEL, ownerPrefix } from "@/lib/labels";
import { daysUntil, formatWon, toYearMonth } from "@/lib/utils";

export const metadata = { title: "카드 내역" };

export default async function CardDetailPage({
  params,
  searchParams,
}: PageProps<"/cards/[cardId]">) {
  const { cardId } = await params;
  const { household, member } = await requireHouseholdContext();

  const card = await prisma.card.findFirst({
    // 다른 가구의 카드 id 로는 접근할 수 없다
    where: { id: cardId, householdId: household.id },
    include: { ownerMember: { select: { displayName: true } } },
  });
  if (!card) notFound();

  const query = await searchParams;
  const canEdit = canManageAsset(member, card);
  const editHref = canEdit ? `/cards/${card.id}/edit` : undefined;

  const title = `${ownerPrefix(card.ownerMember)}${card.issuer ? `${card.issuer} ` : ""}${card.name}`;

  /*
   * 신용카드는 달력 월이 아니라 "결제일 기준 청구서"로 본다.
   * 체크·선불카드는 청구서가 없으므로 기존 월별 사용 내역을 보여준다.
   */
  if (card.type !== "CREDIT" || !card.billingDay) {
    const monthParam = query.month;
    const yearMonth =
      typeof monthParam === "string" && /^\d{4}-\d{2}$/.test(monthParam)
        ? monthParam
        : toYearMonth(new Date());

    const transactions = await getTransactions(household.id, {
      yearMonth,
      monthStartDay: household.monthStartDay,
      cardId: card.id,
      take: 300,
    });

    const expense = transactions
      .filter((transaction) => transaction.type === "EXPENSE")
      .reduce((sum, transaction) => sum + transaction.amount, 0);

    return (
      <AssetDetail
        title={title}
        subtitle={`${CARD_TYPE_LABEL[card.type]}${card.last4 ? ` · ${card.last4}` : ""}`}
        color={card.color}
        editHref={editHref}
        yearMonth={yearMonth}
        summaryItems={[
          { label: "이 달 사용액", value: formatWon(expense), tone: "expense" },
          { label: "건수", value: `${transactions.length}건` },
        ]}
        transactions={transactions}
        emptyMessage="이 달에는 이 카드로 결제한 내역이 없어요."
      />
    );
  }

  // --- 신용카드: 청구서 뷰 ---
  const { options, defaultYearMonth } = await getCardBillingOptions(
    household.id,
    card.id,
  );

  const billParam = query.bill;
  const selected =
    typeof billParam === "string" &&
    options.some((option) => option.yearMonth === billParam)
      ? billParam
      : defaultYearMonth;

  const detail = await getCardStatementDetail(household.id, card.id, selected);
  if (!detail) notFound();

  const { period, statement, canUndo, isOverdue } = detail;
  const dday = daysUntil(period.billingDate);

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur"
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="flex h-14 items-center gap-1 px-2">
          <Link
            href="/cards"
            aria-label="뒤로"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted active:bg-surface-muted"
          >
            <ChevronLeft className="size-5" />
          </Link>

          <span
            className="h-6 w-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: card.color }}
            aria-hidden
          />

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold">{title}</h1>
            <p className="truncate text-xs text-muted">
              {CARD_TYPE_LABEL[card.type]}
              {card.last4 && ` · ${card.last4}`}
              {` · 매월 ${card.billingDay}일 결제`}
            </p>
          </div>

          {editHref && (
            <Link
              href={editHref}
              aria-label="수정"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted active:bg-surface-muted"
            >
              <Pencil className="size-4" />
            </Link>
          )}
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        {/* 결제 회차 선택 — 좌측 상단 */}
        <div className="flex items-center justify-between gap-2">
          <BillingSwitcher
            options={options.map((option) => ({
              yearMonth: option.yearMonth,
              label: option.period
                ? `${option.period.billingDate.getMonth() + 1}월 ${option.period.billingDate.getDate()}일 결제`
                : option.yearMonth,
              amount: option.total,
              isPaid: Boolean(option.statement?.isPaid),
            }))}
            value={selected}
          />

          {statement?.isPaid ? (
            <span className="rounded-full bg-success/15 px-3 py-1.5 text-xs font-medium text-success">
              납부 완료
            </span>
          ) : isOverdue ? (
            <span className="rounded-full bg-expense/15 px-3 py-1.5 text-xs font-medium text-expense">
              {Math.abs(dday)}일 연체
            </span>
          ) : (
            <span className="rounded-full bg-surface-muted px-3 py-1.5 text-xs font-medium text-muted">
              {dday === 0 ? "오늘 결제" : `D-${dday}`}
            </span>
          )}
        </div>

        {/* 청구 요약 */}
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <p className="text-xs opacity-80">
            {period.billingDate.getFullYear()}년{" "}
            {period.billingDate.getMonth() + 1}월{" "}
            {period.billingDate.getDate()}일 결제
          </p>
          <p className="tabular mt-1 text-3xl font-bold tracking-tight">
            {formatWon(statement?.isPaid ? statement.totalAmount : detail.total)}
          </p>
          <p className="mt-2 border-t border-white/20 pt-2 text-xs opacity-80">
            {period.periodStart.getMonth() + 1}/{period.periodStart.getDate()} ~{" "}
            {period.periodEnd.getMonth() + 1}/{period.periodEnd.getDate()} 사용분
            {card.paymentAccountId && detail.card.paymentAccount
              ? ` · ${detail.card.paymentAccount.name}에서 출금`
              : " · 출금 통장 미연결"}
          </p>
          {statement?.isPaid && statement.paidAt && (
            <p className="mt-1 text-xs opacity-80">
              {statement.paidAt.getFullYear()}년{" "}
              {statement.paidAt.getMonth() + 1}월 {statement.paidAt.getDate()}일
              납부함
            </p>
          )}
        </section>

        {/* 납부 처리 */}
        {(detail.total > 0 || statement?.isPaid) && (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface">
            <CardStatementActions
              cardId={card.id}
              yearMonth={selected}
              amount={detail.total}
              accountName={detail.card.paymentAccount?.name ?? null}
              hasAccount={Boolean(card.paymentAccountId)}
              isPaid={Boolean(statement?.isPaid)}
              paidAmount={statement?.totalAmount ?? null}
              canUndo={canUndo}
              isOverdue={isOverdue}
            />
          </div>
        )}

        {/*
          막 등록한 카드는 청구서가 비어 있다 — 기존에 쓴 카드값을
          한 번에 넣을 수 있게 안내한다.
        */}
        {detail.total === 0 && canEdit && (
          <Link
            href={`/cards/${card.id}/opening`}
            className="flex items-center justify-between gap-2 rounded-2xl border border-dashed border-border bg-surface px-4 py-3.5 transition active:bg-surface-muted"
          >
            <span className="min-w-0">
              <span className="block text-sm font-medium">
                이미 쓴 카드값이 있나요?
              </span>
              <span className="block text-xs text-muted">
                일시불·할부 금액만 넣으면 청구서에 반영돼요
              </span>
            </span>
            <Plus className="size-5 shrink-0 text-primary" />
          </Link>
        )}

        {/* 일시불 / 할부 탭 */}
        <StatementTabs
          lumpSumItems={detail.lumpSumItems}
          installmentItems={detail.installmentItems}
          lumpSum={detail.lumpSum}
          installment={detail.installment}
        />
      </div>
    </>
  );
}
