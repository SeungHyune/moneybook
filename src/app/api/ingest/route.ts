import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashText, parseNotification } from "@/lib/parse-notification";
import { resolveCardEffect, insertTransactionWithEffects } from "@/lib/record-transaction";

/**
 * 자동 수집 수신 API.
 *
 * 안드로이드(MacroDroid 등 자동화 앱)나 iOS 단축어가 카드 알림/문자 원문을
 * 여기로 보낸다. 인증은 세션이 아니라 개인 토큰(User.ingestToken)이다.
 *
 * 요청 (아래 중 아무 형태나):
 *   POST /api/ingest?token=XXX          body: 알림 원문 (text/plain)
 *   POST /api/ingest                    body: { "token": "XXX", "text": "...", "source": "macrodroid" }
 *   Authorization: Bearer XXX 헤더도 받는다.
 *
 * 처리:
 *   1) 파싱해서 수신함(IngestInbox)에 저장 (같은 원문은 한 번만)
 *   2) 금액 + 카드(끝 4자리 매칭)가 확실하고 취소 건이 아니면 거래까지 자동 생성
 *   3) 아니면 PENDING 으로 남겨서 앱의 "수신함"에서 확인하게 한다
 */
export async function POST(request: Request) {
  const url = new URL(request.url);

  // --- 토큰과 원문을 여러 형태에서 받아준다 (자동화 앱마다 편한 방식이 다르다) ---
  let token =
    url.searchParams.get("token") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    null;

  let text: string | null = null;
  let source = url.searchParams.get("source") ?? "unknown";

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      const body = (await request.json()) as {
        token?: string;
        text?: string;
        source?: string;
      };
      token = body.token ?? token;
      text = body.text ?? null;
      source = body.source ?? source;
    } catch {
      return NextResponse.json({ error: "잘못된 JSON" }, { status: 400 });
    }
  } else {
    text = await request.text();
  }

  if (!token || token.length < 20) {
    return NextResponse.json({ error: "토큰이 없습니다" }, { status: 401 });
  }
  if (!text || text.trim().length < 5) {
    return NextResponse.json({ error: "본문이 비었습니다" }, { status: 400 });
  }
  if (text.length > 2000) text = text.slice(0, 2000);

  const user = await prisma.user.findUnique({
    where: { ingestToken: token },
    select: { id: true, lastHouseholdId: true },
  });
  if (!user) {
    return NextResponse.json({ error: "유효하지 않은 토큰" }, { status: 401 });
  }

  const parsed = parseNotification(text);
  const textHash = await hashText(text);

  // --- 중복이면 그대로 알려주고 끝 (자동화 앱이 재시도해도 안전) ---
  const existing = await prisma.ingestInbox.findUnique({
    where: { userId_textHash: { userId: user.id, textHash } },
  });
  if (existing) {
    return NextResponse.json({ status: "duplicate", id: existing.id });
  }

  // --- 카드 매칭: 사용자의 현재 가구에서 끝 4자리로 찾는다 ---
  const member = user.lastHouseholdId
    ? await prisma.householdMember.findUnique({
        where: {
          householdId_userId: {
            householdId: user.lastHouseholdId,
            userId: user.id,
          },
        },
      })
    : null;

  const card =
    member && parsed.cardLast4
      ? await prisma.card.findFirst({
          where: {
            householdId: member.householdId,
            last4: parsed.cardLast4,
            isActive: true,
          },
        })
      : null;

  /*
   * 자동 등록 조건: 금액 있음 + 카드 매칭됨 + 취소 아님 + VIEWER 아님.
   * 조건을 못 채우면 PENDING 으로 남긴다 — 틀리게 넣는 것보다 안 넣는 게 낫다.
   */
  const canAutoRecord =
    parsed.amount !== null &&
    parsed.amount > 0 &&
    card !== null &&
    member !== null &&
    member.role !== "VIEWER" &&
    !parsed.isCancel;

  const result = await prisma.$transaction(async (tx) => {
    const inbox = await tx.ingestInbox.create({
      data: {
        userId: user.id,
        rawText: text,
        textHash,
        source,
        amount: parsed.amount,
        merchant: parsed.merchant,
        occurredAt: parsed.occurredAt,
        cardLast4: parsed.cardLast4,
        installmentMonths: parsed.installmentMonths,
        isCancel: parsed.isCancel,
        cardId: card?.id ?? null,
      },
    });

    if (!canAutoRecord) {
      return { status: "pending" as const, inboxId: inbox.id };
    }

    const effect = resolveCardEffect({
      card: card!,
      requestedAccountId: null,
      requestedInstallments: parsed.installmentMonths,
    });

    const transaction = await insertTransactionWithEffects(tx, {
      householdId: member!.householdId,
      type: "EXPENSE",
      amount: parsed.amount!,
      occurredAt: parsed.occurredAt ?? new Date(),
      merchant: parsed.merchant,
      memo: "자동 수집",
      categoryId: null,
      paymentMethod: "CARD",
      card: card!,
      accountId: effect.accountId,
      toAccountId: null,
      installmentMonths: effect.installmentMonths,
      isInterestFree: true,
      interestAmount: 0,
      approvalNo: null,
      payerMemberId: member!.id,
      createdByMemberId: member!.id,
      isShared: true,
      excludeFromStats: false,
    });

    await tx.ingestInbox.update({
      where: { id: inbox.id },
      data: { status: "CONFIRMED", transactionId: transaction.id },
    });

    return {
      status: "recorded" as const,
      inboxId: inbox.id,
      transactionId: transaction.id,
    };
  });

  return NextResponse.json(result, { status: 201 });
}
