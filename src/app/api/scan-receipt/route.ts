import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashText } from "@/lib/parse-notification";
import { parseScannedDate, scanReceiptImage } from "@/lib/gemini";

/**
 * 영수증/결제내역 이미지 스캔.
 *
 * 이미지를 Gemini 로 읽어 결제 건들을 뽑고, 수신함(IngestInbox)에 넣는다.
 * 이미지 인식은 틀릴 수 있으므로 자동 등록하지 않는다 —
 * 반드시 수신함에서 사람이 확인한 뒤 등록한다.
 *
 * 인증: 로그인 세션 (앱 안에서만 호출)
 */

// Gemini 호출이 수 초 걸릴 수 있다
export const maxDuration = 30;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024; //  4MB (클라이언트가 압축해서 보낸다)

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요해요." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("image");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "이미지가 없어요." }, { status: 400 });
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: "이미지가 너무 커요. 다시 시도해 주세요." },
      { status: 400 },
    );
  }

  const mimeType = file.type || "image/jpeg";
  if (!mimeType.startsWith("image/")) {
    return NextResponse.json({ error: "이미지 파일만 올릴 수 있어요." }, {
      status: 400,
    });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  const result = await scanReceiptImage(base64, mimeType);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 502 });
  }

  if (result.transactions.length === 0) {
    return NextResponse.json(
      { error: "이미지에서 결제 내역을 찾지 못했어요." },
      { status: 422 },
    );
  }

  // 카드 매칭용: 사용자의 현재 가구 카드들 (끝 4자리)
  const cards = user.lastHouseholdId
    ? await prisma.card.findMany({
        where: {
          householdId: user.lastHouseholdId,
          isActive: true,
          last4: { not: null },
        },
        select: { id: true, last4: true },
      })
    : [];

  let added = 0;
  let duplicates = 0;

  for (const [index, item] of result.transactions.entries()) {
    const occurredAt = parseScannedDate(item.date, item.time);
    const card =
      item.cardLast4 !== null
        ? (cards.find((row) => row.last4 === item.cardLast4) ?? null)
        : null;

    // 같은 영수증을 두 번 올려도 중복되지 않게 — 내용 기반 해시
    const textHash = await hashText(
      `receipt|${item.merchant}|${item.amount}|${item.date}|${item.time}|${index}`,
    );

    const summary = [
      "📷 영수증",
      item.merchant ?? "가맹점 미확인",
      `${item.amount.toLocaleString("ko-KR")}원`,
      item.date ?? "",
      item.memo ?? "",
    ]
      .filter(Boolean)
      .join(" · ");

    try {
      await prisma.ingestInbox.create({
        data: {
          userId: user.id,
          rawText: summary.slice(0, 500),
          textHash,
          source: "receipt",
          amount: item.amount,
          merchant: item.merchant,
          occurredAt,
          cardLast4: item.cardLast4,
          installmentMonths: item.installmentMonths ?? 1,
          cardId: card?.id ?? null,
        },
      });
      added += 1;
    } catch (error) {
      const isDuplicate =
        error instanceof Error && error.message.includes("Unique constraint");
      if (isDuplicate) duplicates += 1;
      else throw error;
    }
  }

  return NextResponse.json({ added, duplicates });
}
