/**
 * Gemini 로 영수증/결제내역 이미지에서 거래를 추출한다.
 *
 * SDK 대신 REST 를 직접 부른다 — 의존성 없이 한 파일로 끝나고,
 * 구조화 출력(response_schema)으로 파싱 실패가 없다.
 *
 * 환경변수:
 *   GEMINI_API_KEY  필수. 서버에서만 읽는다 (.env — git 에 올라가지 않음)
 *   GEMINI_MODEL    선택. 기본 gemini-3.1-flash-lite
 */

export type ScannedTransaction = {
  amount: number;
  merchant: string | null;
  /** "YYYY-MM-DD" 또는 "MM-DD" — 이미지에 없으면 null */
  date: string | null;
  /** "HH:MM" */
  time: string | null;
  /** 품목 요약 등 참고 메모 */
  memo: string | null;
  cardLast4: string | null;
  installmentMonths: number | null;
};

const DEFAULT_MODEL = "gemini-3.1-flash-lite";

const PROMPT = `이미지를 보고 판별부터 하라. 다음 중 하나일 수 있다:
- receipt: 종이/전자 영수증
- payment_list: 카드·페이·은행 앱의 결제/거래 내역 목록 화면
- order_history: 쇼핑몰·페이 서비스의 주문내역/주문상세/결제상세 화면
  (네이버페이, 토스, 카카오페이, 마켓컬리, 무신사, 쿠팡, 배민 등)
- other: 위 어느 것도 아닌 무관한 이미지

절대 규칙 (가장 중요):
- 이미지에 실제로 인쇄/표시된 글자에서만 추출한다. 보이지 않는 금액·상호·날짜를 추측하거나 지어내는 것은 금지다.
- other 면 transactions 는 빈 배열로 둔다.
- 금액 숫자가 또렷하게 보이지 않는 건은 아예 넣지 않는다.
- 각 필드는 이미지에서 실제로 읽힌 경우에만 채운다. 못 읽었으면 null 로 둔다 —
  빈 칸을 그럴듯한 값으로 메우지 마라. (amount 만 필수, 나머지는 전부 선택이다)

추출 규칙:
- "결제 건" 단위로 추출한다. 한 영수증/한 주문에 상품이 여러 개여도 결제는 한 건이다 —
  실제 결제된 총액("총 결제금액", "최종 결제 금액", "합계") 한 건으로 만들고,
  상품명들은 memo 에 요약한다 (예: "유기농 우유 외 2건").
- 배송비·할인·포인트가 섞여 있으면 실제로 빠져나간 최종 결제액을 amount 로 쓴다.
- 목록 화면(결제내역·주문내역)에 서로 다른 건이 여러 개 보이면 각각 별도 건으로 추출한다.
- merchant: 실제 가맹점/판매처 이름을 우선한다 (네이버페이 결제상세의 가맹점명 등).
  가맹점명이 없으면 서비스 이름(마켓컬리, 무신사, 쿠팡...)을 쓴다.
  영수증이라면 보통 맨 위의 큰 글씨가 상호명이다.
- 결제 수단 문구(네이버페이, 토스페이, 카카오페이, OO카드 등)가 보이면
  memo 끝에 " · 네이버페이" 처럼 덧붙인다.
- "신한카드(1091)" "KB국민 1234" 처럼 카드 표기가 보이면 숫자 4자리를 cardLast4 에 넣는다.
- 할부 표기("3개월" 등)가 있으면 installmentMonths 에 넣는다. 일시불이면 null.
- 날짜/시간이 안 보이면 null. 연도가 없으면 "MM-DD" 형식으로. ("2026.08.10" 같은 점 표기도 날짜다)
- 취소/환불 건 제외: "주문취소", "취소완료", "반품", "환불" 표시가 붙은 건은 넣지 않는다.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    imageType: {
      type: "STRING",
      enum: ["receipt", "payment_list", "order_history", "other"],
      description:
        "영수증 receipt / 결제내역 목록 payment_list / 쇼핑 주문내역·결제상세 order_history / 무관 other",
    },
    transactions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          amount: { type: "INTEGER", description: "결제 금액 (원)" },
          merchant: {
            type: "STRING",
            nullable: true,
            description:
              "가맹점/판매처/서비스 이름. 화면 상단의 브랜드명(마켓컬리 등)도 해당",
          },
          date: { type: "STRING", nullable: true },
          time: { type: "STRING", nullable: true },
          memo: {
            type: "STRING",
            nullable: true,
            description: "상품명 요약 + 보이면 결제수단 (예: 반팔 티셔츠 · 토스페이)",
          },
          cardLast4: { type: "STRING", nullable: true },
          installmentMonths: { type: "INTEGER", nullable: true },
          isCanceled: {
            type: "BOOLEAN",
            description:
              "이 건에 취소/취소완료/반품/환불 표시가 있으면 true, 정상 결제면 false",
          },
        },
        required: ["amount", "isCanceled"],
      },
    },
  },
  required: ["imageType", "transactions"],
} as const;

export async function scanReceiptImage(
  imageBase64: string,
  mimeType: string,
): Promise<
  { ok: true; transactions: ScannedTransaction[] } | { ok: false; error: string }
> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "이미지 인식 키(GEMINI_API_KEY)가 아직 설정되지 않았어요.",
    };
  }

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { inline_data: { mime_type: mimeType, data: imageBase64 } },
              { text: PROMPT },
            ],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: RESPONSE_SCHEMA,
          temperature: 0.1,
        },
      }),
    },
  );

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[gemini] ${response.status} ${body.slice(0, 300)}`);

    if (response.status === 400 || response.status === 403) {
      return { ok: false, error: "이미지 인식 키가 올바르지 않아요." };
    }
    if (response.status === 404) {
      return {
        ok: false,
        error: `모델(${model})을 찾을 수 없어요. GEMINI_MODEL 설정을 확인해 주세요.`,
      };
    }
    if (response.status === 429) {
      return { ok: false, error: "요청이 많아요. 잠시 후 다시 시도해 주세요." };
    }
    return { ok: false, error: "이미지 인식에 실패했어요." };
  }

  try {
    const data = (await response.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    const parsed = JSON.parse(text) as {
      imageType?: string;
      transactions?: unknown[];
    };

    // 판별 게이트: 영수증/결제내역이 아니라고 스스로 판단했으면 결과를 버린다.
    // (무관한 사진에서 그럴듯한 거래를 지어내는 환각 방지)
    if (parsed.imageType === "other") {
      return { ok: true, transactions: [] };
    }

    const transactions: ScannedTransaction[] = (parsed.transactions ?? [])
      .map((raw) => {
        const item = raw as Record<string, unknown>;
        const amount = Number(item.amount);
        if (!Number.isFinite(amount) || amount <= 0) return null;

        // 취소/환불 건은 버린다 (스키마로 건마다 판정을 강제했다)
        if (item.isCanceled === true) return null;

        const str = (value: unknown) =>
          typeof value === "string" && value.trim() ? value.trim() : null;

        const installment = Number(item.installmentMonths);

        return {
          amount: Math.round(amount),
          merchant: str(item.merchant)?.slice(0, 60) ?? null,
          date: str(item.date),
          time: str(item.time),
          memo: str(item.memo)?.slice(0, 200) ?? null,
          cardLast4: /^\d{4}$/.test(String(item.cardLast4 ?? ""))
            ? String(item.cardLast4)
            : null,
          installmentMonths:
            Number.isFinite(installment) && installment > 1
              ? Math.min(60, Math.round(installment))
              : null,
        };
      })
      .filter((item): item is ScannedTransaction => item !== null)
      .slice(0, 20);

    return { ok: true, transactions };
  } catch {
    return { ok: false, error: "인식 결과를 해석하지 못했어요." };
  }
}

/** "YYYY-MM-DD"/"MM-DD"/"MM/DD" + "HH:MM" → Date. 연도가 없으면 올해(미래면 작년) */
export function parseScannedDate(
  date: string | null,
  time: string | null,
  now: Date = new Date(),
): Date | null {
  if (!date) return null;

  const dateMatch = date.match(/(?:(\d{4})[-./])?(\d{1,2})[-./](\d{1,2})/);
  if (!dateMatch) return null;

  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const timeMatch = time?.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? Number(timeMatch[1]) : 12;
  const minute = timeMatch ? Number(timeMatch[2]) : 0;

  let year = dateMatch[1] ? Number(dateMatch[1]) : now.getFullYear();

  if (!dateMatch[1]) {
    const candidate = new Date(year, month - 1, day, hour, minute);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (candidate > tomorrow) year -= 1;
  }

  return new Date(year, month - 1, day, hour, minute);
}
