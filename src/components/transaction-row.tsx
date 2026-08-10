import { PAYMENT_METHOD_LABEL, installmentLabel } from "@/lib/labels";
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
  } | null;
  account: { name: string; bankName: string | null } | null;
  payer: { displayName: string | null; color: string } | null;
};

/**
 * 거래 한 줄.
 * "무엇을, 어떤 수단으로(카드면 일시불/할부까지), 누가" 를 한눈에 보여준다.
 */
export function TransactionRow({
  transaction,
  showDate = false,
}: {
  transaction: TransactionRowData;
  showDate?: boolean;
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
  } = transaction;

  const title = merchant || category?.name || memo || "내역";

  // 결제 수단 표기: "신한 Deep Dream · 3개월 할부"
  const methodParts: string[] = [];

  if (card) {
    methodParts.push(card.last4 ? `${card.name} (${card.last4})` : card.name);
    if (installmentMonths > 1) {
      methodParts.push(installmentLabel(installmentMonths));
    }
  } else if (account) {
    methodParts.push(account.name);
    methodParts.push(PAYMENT_METHOD_LABEL[paymentMethod]);
  } else {
    methodParts.push(PAYMENT_METHOD_LABEL[paymentMethod]);
  }

  const amountColor =
    type === "INCOME"
      ? "text-income"
      : type === "TRANSFER"
        ? "text-transfer"
        : "text-foreground";

  const sign = type === "INCOME" ? "+" : type === "EXPENSE" ? "-" : "";

  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span
        className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
        style={{ backgroundColor: `${category?.color ?? "#9ca3af"}1a` }}
        aria-hidden
      >
        {category?.icon ?? "📌"}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
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
    </li>
  );
}
