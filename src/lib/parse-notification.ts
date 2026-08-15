/**
 * 카드 승인 알림/문자 텍스트 파서.
 *
 * 카드사마다 형식이 제각각이라 "형식별 템플릿"이 아니라
 * "부품(금액·날짜·카드끝자리·할부·가맹점)을 각각 찾는" 방식으로 만든다.
 * 못 찾은 부품은 null 로 남기고, 확인 화면에서 사람이 채운다.
 *
 * 대응 예시:
 *   [Web발신] 신한카드(1234)승인 홍*동 3,500원(일시불) 08/13 14:23 스타벅스 누적1,234,567원
 *   KB국민카드(5678) 08/13 14:23 12,400원 일시불 GS25구로점 사용
 *   [삼성카드] 승인 홍*동님 45,000원 3개월 08/10 20:11 쿠팡
 *   토스페이 스타벅스 3,500원 결제 완료
 */

export type ParsedNotification = {
  amount: number | null;
  merchant: string | null;
  occurredAt: Date | null;
  cardLast4: string | null;
  installmentMonths: number;
  isCancel: boolean;
};

/** 금액 앞에 이런 말이 붙어 있으면 결제 금액이 아니다 */
const AMOUNT_EXCLUDE_BEFORE = /(누적|잔액|한도|총|포인트|적립)\s*$/;

/** 가맹점명이 될 수 없는 토큰들 */
const NOT_MERCHANT =
  /^(웹발신|Web발신|\[Web발신\]|승인|사용|취소|일시불|체크|신용|해외|국내|누적.*|잔액.*|출금|입금|결제\s*완료|완료)$/;

const KNOWN_ISSUERS =
  /(신한|삼성|현대|KB국민|국민|롯데|하나|우리|NH농협|농협|BC|IBK|기업|카카오뱅크|카카오|토스뱅크|토스|케이뱅크|네이버|페이코)\s*(카드|페이|뱅크)?/;

export function parseNotification(
  raw: string,
  now: Date = new Date(),
): ParsedNotification {
  const text = raw.replace(/\r/g, "").trim();

  const isCancel = /승인\s*취소|결제\s*취소|취소\s*승인|취소되었/.test(text);

  // --- 금액: "3,500원" 꼴 중 제외어가 앞에 없는 첫 번째 ---
  let amount: number | null = null;
  const amountPattern = /([\d,]+)\s*원/g;
  for (const match of text.matchAll(amountPattern)) {
    const before = text.slice(Math.max(0, match.index - 8), match.index);
    if (AMOUNT_EXCLUDE_BEFORE.test(before)) continue;

    const value = Number(match[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) {
      amount = value;
      break;
    }
  }

  // --- 카드 끝 4자리: "(1234)" 또는 "카드1234" ---
  const last4Match =
    text.match(/\((\d{4})\)/) ?? text.match(/카드\s*(\d{4})\b/);
  const cardLast4 = last4Match?.[1] ?? null;

  // --- 할부 ---
  const installmentMatch = text.match(/(\d{1,2})\s*개월/);
  const installmentMonths = installmentMatch
    ? Math.max(1, Number(installmentMatch[1]))
    : 1;

  // --- 날짜/시간: "08/13 14:23" (연도는 알림에 없으므로 지금 기준으로 추정) ---
  let occurredAt: Date | null = null;
  const dateMatch = text.match(/(\d{1,2})\/(\d{1,2})/);
  if (dateMatch) {
    const month = Number(dateMatch[1]);
    const day = Number(dateMatch[2]);

    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
      const hour = timeMatch ? Number(timeMatch[1]) : 12;
      const minute = timeMatch ? Number(timeMatch[2]) : 0;

      let year = now.getFullYear();
      const candidate = new Date(year, month - 1, day, hour, minute);
      // 내일 이후 날짜가 나오면 작년 알림으로 본다 (12월 알림을 1월에 붙여넣는 경우)
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (candidate > tomorrow) year -= 1;

      occurredAt = new Date(year, month - 1, day, hour, minute);
    }
  }

  // --- 가맹점: 매칭된 토큰들을 지우고 남는 것 중 가장 그럴듯한 조각 ---
  const cleaned = text
    .replace(/\[[^\]]*\]/g, " ") //  [Web발신], [삼성카드]
    .replace(KNOWN_ISSUERS, " ")
    .replace(/\(\d{4}\)/g, " ")
    .replace(/카드\s*\d{4}\b/g, " ")
    .replace(/[\d,]+\s*원/g, " ")
    .replace(/\d{1,2}\/\d{1,2}/g, " ")
    .replace(/\d{1,2}:\d{2}/g, " ")
    .replace(/\d{1,2}\s*개월/g, " ")
    .replace(/일시불/g, " ")
    .replace(/누적\S*/g, " ")
    .replace(/승인\s*취소|결제\s*취소|취소\s*승인/g, " ")
    .replace(/결제\s*완료|결제|승인|사용\s*완료|완료/g, " ")
    .replace(/[A-Za-z가-힣]\*+[A-Za-z가-힣]?님?/g, " "); //  홍*동님 (마스킹된 이름)

  const candidates = cleaned
    .split(/[\s|]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !NOT_MERCHANT.test(token));

  // 여러 조각이 남으면 이어 붙인다 ("GS25 구로점")
  const merchant = candidates.length > 0 ? candidates.join(" ").slice(0, 60) : null;

  return { amount, merchant, occurredAt, cardLast4, installmentMonths, isCancel };
}

/** 중복 저장 방지용 원문 해시 */
export async function hashText(text: string) {
  const data = new TextEncoder().encode(text.trim());
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
