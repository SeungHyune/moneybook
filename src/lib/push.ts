import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * 웹푸시 발송.
 * iOS 는 16.4+ 에서 "홈 화면에 추가"한 PWA 만 푸시를 받을 수 있다.
 * 수신부는 public/sw.js 의 push 핸들러다.
 */

let configured = false;

function ensureConfigured() {
  if (configured) return true;

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

  if (!publicKey || !privateKey) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
  return true;
}

export type PushPayload = {
  title: string;
  body: string;
  /** 알림을 눌렀을 때 열 경로 */
  url?: string;
  /** 같은 tag 는 이전 알림을 대체한다 (매일 반복 알림용) */
  tag?: string;
};

/**
 * 한 사용자의 모든 기기로 보낸다.
 * 만료된 구독(410/404)은 그 자리에서 지운다 — 기기를 바꾸면 자연히 정리된다.
 */
export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureConfigured()) {
    console.warn("[push] VAPID 키가 없어 발송을 건너뜁니다.");
    return { sent: 0, failed: 0 };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12 },
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        const statusCode =
          typeof error === "object" && error !== null && "statusCode" in error
            ? (error as { statusCode: number }).statusCode
            : 0;

        // 구독이 죽었으면 지운다
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription
            .delete({ where: { id: subscription.id } })
            .catch(() => {});
        }
      }
    }),
  );

  return { sent, failed };
}

/**
 * 가구 구성원 전원에게 (구독한 기기가 있는 사람만 받는다).
 * exceptUserId 를 주면 그 사람은 제외한다 — "내가 등록한 걸 나한테 알리지 않기".
 */
export async function sendPushToHousehold(
  householdId: string,
  payload: PushPayload,
  exceptUserId?: string,
) {
  const members = await prisma.householdMember.findMany({
    where: {
      householdId,
      ...(exceptUserId ? { userId: { not: exceptUserId } } : {}),
    },
    select: { userId: true },
  });

  const results = await Promise.all(
    members.map((member) => sendPushToUser(member.userId, payload)),
  );

  return results.reduce(
    (acc, result) => ({
      sent: acc.sent + result.sent,
      failed: acc.failed + result.failed,
    }),
    { sent: 0, failed: 0 },
  );
}
