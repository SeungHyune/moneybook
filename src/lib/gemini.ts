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

const PROMPT = `이 이미지는 영수증이거나 카드/페이 앱 결제내역 캡처다. 결제 건을 추출하라.

규칙:
- "결제 건" 단위로 추출한다. 한 영수증에 여러 상품이 있어도 결제는 한 건이다 —
  합계 금액 한 건으로 만들고, 상품명들은 memo 에 요약한다 (예: "아메리카노 외 2건").
- 결제내역 목록 캡처처럼 서로 다른 결제가 여러 건 보이면 각각 별도 건으로 추출한다.
- amount 는 원 단위 정수. 합계/총액을 쓰고, 할인 반영된 실결제액을 우선한다.
- 카드번호가 보이면 끝 4자리만 cardLast4 에 넣는다.
- 할부 표기("3개월" 등)가 있으면 installmentMonths 에 넣는다. 일시불이면 null.
- 날짜/시간이 안 보이면 null. 연도가 없으면 "MM-DD" 형식으로.
- 확실하지 않은 값은 지어내지 말고 null 로 둔다.
- 결제 취소/환불 건은 제외한다.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    transactions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          amount: { type: "INTEGER", description: "결제 금액 (원)" },
          merchant: { type: "STRING", nullable: true },
          date: { type: "STRING", nullable: true },
          time: { type: "STRING", nullable: true },
          memo: { type: "STRING", nullable: true },
          cardLast4: { type: "STRING", nullable: true },
          installmentMonths: { type: "INTEGER", nullable: true },
        },
        required: ["amount"],
      },
    },
  },
  required: ["transactions"],
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
    const parsed = JSON.parse(text) as { transactions?: unknown[] };

    const transactions: ScannedTransaction[] = (parsed.transactions ?? [])
      .map((raw) => {
        const item = raw as Record<string, unknown>;
        const amount = Number(item.amount);
        if (!Number.isFinite(amount) || amount <= 0) return null;

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
