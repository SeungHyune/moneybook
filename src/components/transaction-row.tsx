import Link from "next/link";
import { CategoryIcon } from "@/components/category-icon";
import {
  PAYMENT_METHOD_LABEL,
  installmentLabel,
  ownerPrefix,
} from "@/lib/labels";
import { formatWon } from "@/lib/utils";
import type {
  PaymentMethod,
  TransactionType,
} from "@/generated/prisma/enums";

export type TransactionRowData = {
  id: string;
  type: TransactionType;
  amount: number;
  occurredAt: Date;
  merchant: string | null;
  memo: string | null;
  paymentMethod: PaymentMethod;
  installmentMonths: number;
  isShared: boolean;
  category: { name: string; icon: string | null; color: string } | null;
  card: {
    name: string;
    issuer: string | null;
    color: string;
    last4: string | null;
    ownerMember?: { displayName: string | null } | null;
  } | null;
  account: {
    name: string;
    bankName: string | null;
    ownerMember?: { displayName: string | null } | null;
  } | null;
  /** 이체 받는 계좌 */
  toAccount?: {
    name: string;
    bankName: string | null;
    ownerMember?: { displayName: string | null } | null;
  } | null;
  payer: { displayName: string | null; color: string } | null;
  /** 통계 합계에서 빠지는 건 (카드대금 납부, 기존 카드값 등) */
  excludeFromStats?: boolean;
  /** 이번 달에 잡히는 금액. 할부면 그 회차 금액 (없으면 amount) */
  monthlyAmount?: number;
  /** 할부 회차 — 2/4 처럼 보여준다 */
  round?: number | null;
  totalRounds?: number | null;
};

/**
 * 거래 한 줄.
 * "무엇을, 어떤 수단으로(카드면 일시불/할부까지), 누가" 를 한눈에 보여준다.
 */
export function TransactionRow({
  transaction,
  showDate = false,
  /** 눌렀을 때 수정 화면으로 갈지 (목록에서는 true) */
  editable = true,
}: {
  transaction: TransactionRowData;
  showDate?: boolean;
  editable?: boolean;
}) {
  const {
    type,
    amount,
    merchant,
    memo,
    paymentMethod,
    installmentMonths,
    category,
    card,
    account,
    toAccount,
    payer,
    occurredAt,
    excludeFromStats,
    round,
    totalRounds,
  } = transaction;

  /*
   * 할부는 원금이 아니라 이번 달 나가는 회차 금액을 큰 숫자로 둔다.
   * 지출 합계가 회차 기준이라, 원금을 크게 쓰면 목록을 더해도 합계가
   * 안 맞는다. 원금은 아래에 작게 적는다.
   */
  const shownAmount = transaction.monthlyAmount ?? amount;
  const isInstallmentRound = Boolean(totalRounds && totalRounds > 1 && round);

  const title = merchant || category?.name || memo || "내역";

  // 결제 수단 표기: "신한 Deep Dream · 3개월 할부"
  const methodParts: string[] = [];

  /*
   * 이체는 "어디서 어디로" 가 전부다. 출금 계좌만 적으면 지출과 구분이 안 돼
   * 돈이 나간 것처럼 읽힌다 — 실제로는 내 계좌 사이를 옮긴 것뿐이다.
   */
  if (type === "TRANSFER") {
    methodParts.push(
      [
        account ? `${ownerPrefix(account.ownerMember)}${account.name}` : "?",
        toAccount
          ? `${ownerPrefix(toAccount.ownerMember)}${toAccount.name}`
          : "?",
      ].join(" → "),
    );
  } else if (card) {
    methodParts.push(
      `${ownerPrefix(card.ownerMember)}${card.last4 ? `${card.name} (${card.last4})` : card.name}`,
    );
    if (installmentMonths > 1) {
      methodParts.push(installmentLabel(installmentMonths));
    }
  } else if (account) {
    methodParts.push(`${ownerPrefix(account.ownerMember)}${account.name}`);
    methodParts.push(PAYMENT_METHOD_LABEL[paymentMethod]);
  } else {
    methodParts.push(PAYMENT_METHOD_LABEL[paymentMethod]);
  }

  /*
   * 카드대금 납부처럼 합계에서 빠지는 건은 흐리게 둔다.
   * 개별 결제가 이미 지출로 잡혀 있어 이것까지 세면 이중 계산이 되는데,
   * 통장에서 실제로 나간 돈이라 목록에서 지우지는 않는다.
   * 표시를 안 하면 "목록을 더해도 합계와 안 맞는" 상태가 된다.
   */
  const amountColor = excludeFromStats
    ? "text-muted"
    : type === "INCOME"
      ? "text-income"
      : type === "TRANSFER"
        ? "text-transfer"
        : "text-foreground";

  const sign = type === "INCOME" ? "+" : type === "EXPENSE" ? "-" : "";

  const content = (
    <>
      <CategoryIcon
        icon={category?.icon ?? "📌"}
        color={category?.color ?? "#9ca3af"}
        size="md"
      />

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <span className="truncate">{title}</span>
          {type === "TRANSFER" && (
            <span className="shrink-0 rounded-md bg-transfer/15 px-1.5 py-0.5 text-[10px] font-normal text-transfer">
              계좌 이동
            </span>
          )}
          {excludeFromStats && (
            <span className="shrink-0 rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-normal text-muted">
              합계 제외
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted">
          {showDate && `${occurredAt.getDate()}일 · `}
          {methodParts.join(" · ")}
          {payer?.displayName && ` · ${payer.displayName}`}
        </p>
      </div>

      <div className="shrink-0 text-right">
        <span className={`tabular text-sm font-bold ${amountColor}`}>
          {sign}
          {formatWon(shownAmount)}
        </span>
        {isInstallmentRound && (
          <p className="text-[10px] text-muted">
            {round}/{totalRounds}회차 · 총 {formatWon(amount)}
          </p>
        )}
      </div>
    </>
  );

  return (
    <li className="first:pt-0 last:pb-0">
      {editable ? (
        // 줄을 누르면 수정 화면으로
        <Link
          href={`/transactions/${transaction.id}/edit`}
          className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 transition active:bg-surface-muted"
        >
          {content}
        </Link>
      ) : (
        <div className="flex items-center gap-3 py-3">{content}</div>
      )}
    </li>
  );
}
