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

/**
 * 고정 수입/지출 종류.
 * emoji 는 CategoryIcon 이 벡터 아이콘으로 바꿔 그리는 키다.
 * color 는 아이콘 타일 색.
 */
export const RECURRING_KIND_META: Record<
  RecurringKind,
  { label: string; emoji: string; color: string; type: "INCOME" | "EXPENSE" }
> = {
  SALARY: { label: "월급", emoji: "💰", color: "#2563eb", type: "INCOME" },
  SIDE_INCOME: { label: "부수입", emoji: "🪙", color: "#0891b2", type: "INCOME" },
  CARD_BILL: { label: "카드대금", emoji: "💳", color: "#7c3aed", type: "EXPENSE" },
  MAINTENANCE_FEE: { label: "관리비", emoji: "🏢", color: "#8b5cf6", type: "EXPENSE" },
  TELECOM: { label: "통신비", emoji: "📱", color: "#06b6d4", type: "EXPENSE" },
  UTILITY: { label: "공과금", emoji: "💡", color: "#f59e0b", type: "EXPENSE" },
  RENT: { label: "월세/주거비", emoji: "🏠", color: "#f97316", type: "EXPENSE" },
  LOAN_REPAYMENT: { label: "대출상환", emoji: "🏦", color: "#78716c", type: "EXPENSE" },
  INSURANCE: { label: "보험료", emoji: "🛡️", color: "#64748b", type: "EXPENSE" },
  SUBSCRIPTION: { label: "구독료", emoji: "🎬", color: "#a855f7", type: "EXPENSE" },
  SAVINGS: { label: "저축/적금", emoji: "🐷", color: "#22c55e", type: "EXPENSE" },
  EDUCATION: { label: "교육비", emoji: "📚", color: "#6366f1", type: "EXPENSE" },
  MEMBERSHIP: { label: "회비", emoji: "🤝", color: "#ec4899", type: "EXPENSE" },
  OTHER: { label: "기타", emoji: "📌", color: "#9ca3af", type: "EXPENSE" },
};

/**
 * 카드/계좌 이름 앞에 붙는 소유자 접두어.
 * 부부가 같은 은행 계좌를 하나씩 갖고 있으면 이름만으로 구분이 안 된다.
 * 소유자가 지정된 것만 "아라 · " 처럼 붙이고, 공용은 그대로 둔다.
 */
export function ownerPrefix(
  ownerMember: { displayName: string | null } | null | undefined,
) {
  return ownerMember?.displayName ? `${ownerMember.displayName} · ` : "";
}

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

/**
 * "앞으로 나갈 돈" 을 묶어 보는 분류.
 *
 * 고정지출의 kind 는 14 가지라 그대로 늘어놓으면 한눈에 안 들어온다.
 * 성격이 비슷한 것끼리(보험·통신, 구독·회비) 묶고, 카드 청구는 따로 둔다.
 */
export const OUTFLOW_GROUPS = [
  { key: "CARD", label: "카드 결제", emoji: "💳" },
  { key: "HOUSING", label: "주거·공과금", emoji: "🏢" },
  { key: "INSURANCE_TELECOM", label: "보험·통신", emoji: "🛡️" },
  { key: "SUBSCRIPTION", label: "구독·회비", emoji: "🎬" },
  { key: "SAVING_LOAN", label: "저축·대출", emoji: "🐷" },
  { key: "ETC", label: "그 밖에", emoji: "📌" },
  { key: "INCOME", label: "들어올 돈", emoji: "💰" },
] as const;

export type OutflowGroupKey = (typeof OUTFLOW_GROUPS)[number]["key"];

export const OUTFLOW_GROUP_OF: Record<RecurringKind, OutflowGroupKey> = {
  SALARY: "INCOME",
  SIDE_INCOME: "INCOME",
  CARD_BILL: "CARD",
  MAINTENANCE_FEE: "HOUSING",
  RENT: "HOUSING",
  UTILITY: "HOUSING",
  TELECOM: "INSURANCE_TELECOM",
  INSURANCE: "INSURANCE_TELECOM",
  SUBSCRIPTION: "SUBSCRIPTION",
  MEMBERSHIP: "SUBSCRIPTION",
  EDUCATION: "SUBSCRIPTION",
  SAVINGS: "SAVING_LOAN",
  LOAN_REPAYMENT: "SAVING_LOAN",
  OTHER: "ETC",
};
