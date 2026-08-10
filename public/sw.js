/**
 * 가계부 PWA 서비스워커.
 *
 * 정책:
 *  - 금융 데이터는 오래된 걸 보여주면 안 되므로 페이지/데이터는 "네트워크 우선"
 *  - 빌드 산출물(/_next/static)만 "캐시 우선" (파일명에 해시가 붙어 안전)
 *  - 오프라인이면 /offline 안내 페이지로 폴백
 *
 * 캐시 정책을 바꿨다면 CACHE_VERSION 을 올려야 이전 캐시가 정리된다.
 */

const CACHE_VERSION = "v1";
const STATIC_CACHE = `moneybook-static-${CACHE_VERSION}`;
const PAGE_CACHE = `moneybook-pages-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";

const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      // 하나 실패해도 설치 자체는 진행되도록 개별 처리
      await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== PAGE_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/** 빌드 산출물처럼 내용이 바뀌지 않는 자원인지 */
function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:woff2?|ttf|otf|png|jpg|jpeg|gif|webp|svg|ico)$/.test(url.pathname)
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // GET 이 아닌 요청(서버 액션, API 쓰기)은 절대 건드리지 않는다
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // 다른 오리진(Supabase API, 카카오 등)은 그대로 통과
  if (url.origin !== self.location.origin) return;

  // 인증 흐름은 캐시하면 안 된다
  if (url.pathname.startsWith("/auth")) return;

  // 1) 정적 자산: 캐시 우선
  if (isImmutableAsset(url)) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;

        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(STATIC_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          return Response.error();
        }
      })(),
    );
    return;
  }

  // 2) 페이지 이동: 네트워크 우선 + 오프라인 폴백
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response.ok) {
            const cache = await caches.open(PAGE_CACHE);
            cache.put(request, response.clone());
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;

          const offline = await caches.match(OFFLINE_URL);
          return (
            offline ??
            new Response("오프라인 상태입니다.", {
              status: 503,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            })
          );
        }
      })(),
    );
  }

  // 그 외 GET(RSC 페이로드 등)은 브라우저 기본 동작에 맡긴다
});

/**
 * 고정지출 알림용 푸시 수신부.
 * 서버에서 Web Push 를 붙이면 그대로 동작한다.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "우리집 가계부", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "우리집 가계부", {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url ?? "/" },
      tag: payload.tag,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url ?? "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      // 이미 열린 창이 있으면 그걸 재사용
      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
