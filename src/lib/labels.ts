/**
 * Prisma enum -> 한글 라벨 매핑.
 * enums.ts 는 순수 상수 파일이라 클라이언트 컴포넌트에서 import 해도 안전하다.
 */
import type {
  AccountType,
  CardType,
  Frequency,
  MemberRole,
  OccurrenceStatus,
  PaymentMethod,
  RecurringKind,
  TransactionType,
} from "@/generated/prisma/enums";

export const TRANSACTION_TYPE_LABEL: Record<TransactionType, string> = {
  INCOME: "수입",
  EXPENSE: "지출",
  TRANSFER: "이체",
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "현금",
  CARD: "카드",
  BANK_TRANSFER: "계좌이체",
  AUTO_DEBIT: "자동이체",
  MOBILE_PAY: "간편결제",
  POINT: "포인트",
  GIFT_CARD: "상품권",
  OTHER: "기타",
};

export const CARD_TYPE_LABEL: Record<CardType, string> = {
  CREDIT: "신용카드",
  DEBIT: "체크카드",
  PREPAID: "선불카드",
};

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  CHECKING: "입출금",
  SAVINGS: "예적금",
  CASH: "현금",
  INVESTMENT: "투자",
  LOAN: "대출",
  OTHER: "기타",
};

export const MEMBER_ROLE_LABEL: Record<MemberRole, string> = {
  OWNER: "관리자(개설자)",
  ADMIN: "관리자",
  MEMBER: "구성원",
  VIEWER: "보기 전용",
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  MONTHLY: "매월",
  WEEKLY: "매주",
  YEARLY: "매년",
  BIMONTHLY: "격월",
  QUARTERLY: "분기",
};

export const OCCURRENCE_STATUS_LABEL: Record<OccurrenceStatus, string> = {
  PENDING: "예정",
  PAID: "납부완료",
  SKIPPED: "건너뜀",
  OVERDUE: "연체",
};

/** 고정 수입/지출 종류. 아이콘은 이모지로 둬서 별도 에셋 없이 쓴다. */
export const RECURRING_KIND_META: Record<
  RecurringKind,
  { label: string; emoji: string; type: "INCOME" | "EXPENSE" }
> = {
  SALARY: { label: "월급", emoji: "💰", type: "INCOME" },
  SIDE_INCOME: { label: "부수입", emoji: "🪙", type: "INCOME" },
  CARD_BILL: { label: "카드대금", emoji: "💳", type: "EXPENSE" },
  MAINTENANCE_FEE: { label: "관리비", emoji: "🏢", type: "EXPENSE" },
  TELECOM: { label: "통신비", emoji: "📱", type: "EXPENSE" },
  UTILITY: { label: "공과금", emoji: "💡", type: "EXPENSE" },
  RENT: { label: "월세/주거비", emoji: "🏠", type: "EXPENSE" },
  LOAN_REPAYMENT: { label: "대출상환", emoji: "🏦", type: "EXPENSE" },
  INSURANCE: { label: "보험료", emoji: "🛡️", type: "EXPENSE" },
  SUBSCRIPTION: { label: "구독료", emoji: "🎬", type: "EXPENSE" },
  SAVINGS: { label: "저축/적금", emoji: "🐷", type: "EXPENSE" },
  EDUCATION: { label: "교육비", emoji: "📚", type: "EXPENSE" },
  MEMBERSHIP: { label: "회비", emoji: "🤝", type: "EXPENSE" },
  OTHER: { label: "기타", emoji: "📌", type: "EXPENSE" },
};

/** 할부 개월 선택지 */
export const INSTALLMENT_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 10, 12, 18, 24, 36];

export function installmentLabel(months: number) {
  return months <= 1 ? "일시불" : `${months}개월 할부`;
}

/** 카드사 목록 (카드 등록 시 선택) */
export const CARD_ISSUERS = [
  "신한카드",
  "삼성카드",
  "현대카드",
  "KB국민카드",
  "롯데카드",
  "하나카드",
  "우리카드",
  "NH농협카드",
  "BC카드",
  "IBK기업은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "기타",
];

export const BANKS = [
  "KB국민은행",
  "신한은행",
  "우리은행",
  "하나은행",
  "NH농협은행",
  "IBK기업은행",
  "카카오뱅크",
  "토스뱅크",
  "케이뱅크",
  "SC제일은행",
  "새마을금고",
  "우체국",
  "기타",
];
