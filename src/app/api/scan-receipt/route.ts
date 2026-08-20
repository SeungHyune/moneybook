import { NextResponse } from "next/server";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { hashText } from "@/lib/parse-notification";
import { parseScannedDate, scanReceiptImage } from "@/lib/gemini";

/**
 * 영수증/결제내역 이미지 스캔 — 백그라운드 큐 방식.
 *
 * 1) 업로드 즉시 "분석 중(QUEUED)" 행을 만들고 바로 응답한다 (수백 ms)
 * 2) AI 분석은 응답 이후 after() 에서 이어서 실행된다
 * 3) 끝나면 행이 PENDING(확인 대기) 또는 FAILED 로 바뀐다 —
 *    수신함이 폴링으로 갱신되어 결과가 나타난다
 *
 * 이미지 인식은 틀릴 수 있으므로 자동 등록하지 않는다.
 * 같은 이미지를 두 번 올리면 이미지 해시로 걸러진다.
 */

// after() 의 AI 분석까지 이 시간 안에 끝나야 한다
export const maxDuration = 60;

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

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
    return NextResponse.json(
      { error: "이미지 파일만 올릴 수 있어요." },
      { status: 400 },
    );
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");

  // 같은 이미지 재업로드 차단 (이미지 자체의 해시)
  const imageHash = await hashText(base64);

  const existing = await prisma.ingestInbox.findUnique({
    where: { userId_textHash: { userId: user.id, textHash: imageHash } },
  });
  if (existing) {
    return NextResponse.json({ status: "duplicate" });
  }

  // 1) 분석 중 표시용 행 — 수신함에 바로 보인다
  const queued = await prisma.ingestInbox.create({
    data: {
      userId: user.id,
      rawText: "📷 이미지를 읽고 있어요...",
      textHash: imageHash,
      source: "receipt",
      status: "QUEUED",
    },
  });

  const lastHouseholdId = user.lastHouseholdId;
  const userId = user.id;

  // 2) 응답을 보낸 뒤 백그라운드에서 분석
  after(async () => {
    try {
      const result = await scanReceiptImage(base64, mimeType);

      if (!result.ok) {
        await prisma.ingestInbox.update({
          where: { id: queued.id },
          data: { status: "FAILED", rawText: `📷 실패: ${result.error}` },
        });
        return;
      }

      if (result.transactions.length === 0) {
        await prisma.ingestInbox.update({
          where: { id: queued.id },
          data: {
            status: "FAILED",
            rawText: "📷 이미지에서 결제 내역을 찾지 못했어요",
          },
        });
        return;
      }

      // 카드 매칭용: 현재 가구의 끝 4자리 있는 카드들
      const cards = lastHouseholdId
        ? await prisma.card.findMany({
            where: {
              householdId: lastHouseholdId,
              isActive: true,
              last4: { not: null },
            },
            select: { id: true, last4: true },
          })
        : [];

      for (const [index, item] of result.transactions.entries()) {
        const occurredAt = parseScannedDate(item.date, item.time);
        const card =
          item.cardLast4 !== null
            ? (cards.find((row) => row.last4 === item.cardLast4) ?? null)
            : null;

        const summary = [
          "📷",
          item.merchant ?? "가맹점 미확인",
          `${item.amount.toLocaleString("ko-KR")}원`,
          item.date ?? "",
          item.memo ?? "",
        ]
          .filter(Boolean)
          .join(" · ")
          .slice(0, 500);

        const data = {
          amount: item.amount,
          merchant: item.merchant,
          occurredAt,
          cardLast4: item.cardLast4,
          installmentMonths: item.installmentMonths ?? 1,
          cardId: card?.id ?? null,
          rawText: summary,
          status: "PENDING" as const,
        };

        if (index === 0) {
          // 첫 건은 분석 중 행을 결과로 바꾼다
          await prisma.ingestInbox.update({
            where: { id: queued.id },
            data,
          });
        } else {
          // 나머지 건은 이미지 해시 + 순번으로 추가
          await prisma.ingestInbox
            .create({
              data: {
                ...data,
                userId,
                source: "receipt",
                textHash: `${imageHash}:${index}`,
              },
            })
            .catch(() => {}); //  재시도로 인한 중복이면 무시
        }
      }
    } catch (error) {
      console.error("[scan-receipt] 백그라운드 분석 실패", error);
      await prisma.ingestInbox
        .update({
          where: { id: queued.id },
          data: {
            status: "FAILED",
            rawText: "📷 실패: 분석 중 오류가 났어요. 다시 올려 주세요.",
          },
        })
        .catch(() => {});
    }
  });

  // 3) 즉시 응답 — 분석을 기다리지 않는다
  return NextResponse.json({ status: "queued", inboxId: queued.id }, { status: 202 });
}
