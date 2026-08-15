"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { sendPushToUser } from "@/lib/push";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

/** 브라우저 pushManager.subscribe() 결과를 저장한다 */
export async function savePushSubscription(input: unknown, userAgent?: string) {
  const user = await requireUser();

  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) return { error: "구독 정보가 올바르지 않아요." };

  await prisma.pushSubscription.upsert({
    where: { endpoint: parsed.data.endpoint },
    create: {
      userId: user.id,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent: userAgent?.slice(0, 200) ?? null,
    },
    // 다른 계정으로 로그인해 다시 구독하면 주인을 바꿔준다
    update: {
      userId: user.id,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
    },
  });

  return { success: true };
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser();

  await prisma.pushSubscription.deleteMany({
    where: { endpoint, userId: user.id },
  });

  return { success: true };
}

/** 설정 화면의 "테스트 알림" — 지금 이 사용자의 모든 기기로 */
export async function sendTestPush() {
  const user = await requireUser();

  const { sent, failed } = await sendPushToUser(user.id, {
    title: "우리집 가계부",
    body: "알림이 잘 도착하고 있어요 👋",
    url: "/",
    tag: "test",
  });

  if (sent === 0) {
    return {
      error:
        failed > 0
          ? "발송에 실패했어요. 알림을 껐다 켜 보세요."
          : "구독된 기기가 없어요.",
    };
  }
  return { success: `${sent}개 기기로 보냈어요.` };
}
