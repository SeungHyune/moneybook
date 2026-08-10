import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 12000 -> "12,000원" */
export function formatWon(amount: number, withUnit = true) {
  const formatted = new Intl.NumberFormat("ko-KR").format(Math.round(amount));
  return withUnit ? `${formatted}원` : formatted;
}

/** 12000 -> "1.2만", 1250000 -> "125만" (대시보드 요약용) */
export function formatWonShort(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";

  if (abs >= 100_000_000) {
    return `${sign}${(abs / 100_000_000).toFixed(abs % 100_000_000 === 0 ? 0 : 1)}억`;
  }
  if (abs >= 10_000) {
    return `${sign}${(abs / 10_000).toFixed(abs % 10_000 === 0 ? 0 : 1)}만`;
  }
  return `${sign}${new Intl.NumberFormat("ko-KR").format(abs)}`;
}

/** Date -> "2026-08" */
export function toYearMonth(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** "2026-08" -> Date(2026, 7, 1) */
export function fromYearMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** "2026-08" -> "2026년 8월" */
export function formatYearMonth(yearMonth: string) {
  const [y, m] = yearMonth.split("-").map(Number);
  return `${y}년 ${m}월`;
}

export function addMonths(yearMonth: string, delta: number) {
  const date = fromYearMonth(yearMonth);
  date.setMonth(date.getMonth() + delta);
  return toYearMonth(date);
}

/**
 * 해당 연월에서 원하는 "일"에 맞는 Date 를 만든다.
 * 31일로 설정했는데 2월이면 말일(28/29일)로 자동 보정한다.
 */
export function dayOfMonthToDate(year: number, month1to12: number, day: number) {
  const lastDay = new Date(year, month1to12, 0).getDate();
  return new Date(year, month1to12 - 1, Math.min(day, lastDay));
}

/** 주말이면 앞/뒤 평일로 옮긴다. (공휴일은 아직 반영하지 않음) */
export function shiftToBusinessDay(
  date: Date,
  direction: "prev" | "next" | "none",
) {
  if (direction === "none") return date;

  const result = new Date(date);
  const step = direction === "prev" ? -1 : 1;

  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + step);
  }
  return result;
}

/** "오늘", "어제", "8월 3일 (월)" */
export function formatRelativeDate(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(date);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) return "오늘";
  if (diffDays === -1) return "어제";
  if (diffDays === 1) return "내일";

  const weekday = ["일", "월", "화", "수", "목", "금", "토"][target.getDay()];
  return `${target.getMonth() + 1}월 ${target.getDate()}일 (${weekday})`;
}

/** D-day 계산. 양수면 남은 날. */
export function daysUntil(date: Date) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/** 초대 코드용 짧은 코드. 헷갈리는 글자(0/O/1/I)는 뺐다. */
export function generateInviteCode(length = 8) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
