"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

/** 수신함 항목 버리기 */
export async function discardInboxItem(inboxId: string) {
  const user = await requireUser();

  await prisma.ingestInbox.updateMany({
    where: { id: inboxId, userId: user.id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "DISCARDED" },
  });

  revalidatePath("/inbox");
  return { success: true };
}

/** 붙여넣기로 직접 넣는 경우 (자동화 없이도 파서를 쓸 수 있게) */
export async function ingestPastedText(text: string) {
  const user = await requireUser();

  if (!text || text.trim().length < 5) {
    return { error: "내용을 붙여넣어 주세요." };
  }

  // 파서와 저장 로직은 API 라우트와 동일 — fetch 로 자기 자신을 부르는 대신
  // 토큰을 새로 안 만들도록 여기서 직접 처리한다
  const { parseNotification, hashText } = await import(
    "@/lib/parse-notification"
  );

  const trimmed = text.slice(0, 2000);
  const parsed = parseNotification(trimmed);
  const textHash = await hashText(trimmed);

  const existing = await prisma.ingestInbox.findUnique({
    where: { userId_textHash: { userId: user.id, textHash } },
  });
  if (existing) {
    return { error: "이미 등록한 내용이에요." };
  }

  const card =
    user.lastHouseholdId && parsed.cardLast4
      ? await prisma.card.findFirst({
          where: {
            householdId: user.lastHouseholdId,
            last4: parsed.cardLast4,
            isActive: true,
          },
        })
      : null;

  const inbox = await prisma.ingestInbox.create({
    data: {
      userId: user.id,
      rawText: trimmed,
      textHash,
      source: "paste",
      amount: parsed.amount,
      merchant: parsed.merchant,
      occurredAt: parsed.occurredAt,
      cardLast4: parsed.cardLast4,
      installmentMonths: parsed.installmentMonths,
      isCancel: parsed.isCancel,
      cardId: card?.id ?? null,
    },
  });

  revalidatePath("/inbox");
  return { success: true, inboxId: inbox.id };
}
