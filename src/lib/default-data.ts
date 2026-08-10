import type { TransactionType } from "@/generated/prisma/enums";

/** 가구를 만들 때 자동으로 깔리는 기본 카테고리 */
export const DEFAULT_CATEGORIES: {
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}[] = [
  // 지출
  { name: "식비", type: "EXPENSE", icon: "🍚", color: "#f97316" },
  { name: "카페/간식", type: "EXPENSE", icon: "☕", color: "#d97706" },
  { name: "교통/차량", type: "EXPENSE", icon: "🚗", color: "#0ea5e9" },
  { name: "주거/관리비", type: "EXPENSE", icon: "🏢", color: "#8b5cf6" },
  { name: "통신비", type: "EXPENSE", icon: "📱", color: "#06b6d4" },
  { name: "생활용품", type: "EXPENSE", icon: "🧻", color: "#84cc16" },
  { name: "의류/미용", type: "EXPENSE", icon: "👕", color: "#ec4899" },
  { name: "의료/건강", type: "EXPENSE", icon: "💊", color: "#ef4444" },
  { name: "교육", type: "EXPENSE", icon: "📚", color: "#6366f1" },
  { name: "문화/여가", type: "EXPENSE", icon: "🎬", color: "#a855f7" },
  { name: "여행", type: "EXPENSE", icon: "✈️", color: "#14b8a6" },
  { name: "경조사", type: "EXPENSE", icon: "🎁", color: "#f43f5e" },
  { name: "보험", type: "EXPENSE", icon: "🛡️", color: "#64748b" },
  { name: "저축/투자", type: "EXPENSE", icon: "🐷", color: "#22c55e" },
  { name: "대출상환", type: "EXPENSE", icon: "🏦", color: "#78716c" },
  { name: "세금/수수료", type: "EXPENSE", icon: "🧾", color: "#94a3b8" },
  { name: "반려동물", type: "EXPENSE", icon: "🐾", color: "#c084fc" },
  { name: "기타지출", type: "EXPENSE", icon: "📌", color: "#9ca3af" },

  // 수입
  { name: "월급", type: "INCOME", icon: "💰", color: "#2563eb" },
  { name: "상여금", type: "INCOME", icon: "🎉", color: "#3b82f6" },
  { name: "부수입", type: "INCOME", icon: "🪙", color: "#0891b2" },
  { name: "용돈", type: "INCOME", icon: "🧧", color: "#7c3aed" },
  { name: "금융소득", type: "INCOME", icon: "📈", color: "#059669" },
  { name: "기타수입", type: "INCOME", icon: "📥", color: "#6b7280" },
];

/** 온보딩에서 "이런 게 있어요" 하고 보여줄 고정지출 예시 */
export const FIXED_EXPENSE_PRESETS = [
  { kind: "SALARY" as const, name: "월급", dayOfMonth: 25, type: "INCOME" as const },
  { kind: "CARD_BILL" as const, name: "카드대금", dayOfMonth: 25, type: "EXPENSE" as const },
  { kind: "MAINTENANCE_FEE" as const, name: "아파트 관리비", dayOfMonth: 30, type: "EXPENSE" as const },
  { kind: "TELECOM" as const, name: "휴대폰 요금", dayOfMonth: 15, type: "EXPENSE" as const },
  { kind: "SUBSCRIPTION" as const, name: "넷플릭스", dayOfMonth: 1, type: "EXPENSE" as const },
  { kind: "INSURANCE" as const, name: "보험료", dayOfMonth: 10, type: "EXPENSE" as const },
];
