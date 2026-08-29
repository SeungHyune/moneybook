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
  payer: { displayName: string | null; color: string } | null;
  /** 통계 합계에서 빠지는 건 (카드대금 납부, 기존 카드값 등) */
  excludeFromStats?: boolean;
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
    payer,
    occurredAt,
    excludeFromStats,
  } = transaction;

  const title = merchant || category?.name || memo || "내역";

  // 결제 수단 표기: "신한 Deep Dream · 3개월 할부"
  const methodParts: string[] = [];

  if (card) {
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

      <span className={`tabular shrink-0 text-sm font-bold ${amountColor}`}>
        {sign}
        {formatWon(amount)}
      </span>
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
