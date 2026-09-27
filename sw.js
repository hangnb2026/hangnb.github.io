/*
 * 개발 중 오래된 JavaScript가 계속 남는 문제를 막기 위해
 * cache-first 대신 network-first 전략을 사용합니다.
 *
 * 캐시 이름을 변경하면 이전 버전 캐시도 activate 단계에서 삭제됩니다.
 */
const CACHE_NAME = "traffic-helper-shell-v10";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/style.css",
  "./js/app.js",
  "./js/config.js",
  "./js/csv.js",
  "./js/data.js",
  "./js/analysis.js",
  "./js/video.js",
  "./js/heatmap.js",
  "./js/store.js",
  "./js/gps.js",
  "./js/notifications.js",
  "./js/monitor.js",
  "./files/bg_olympicpark.png",
  "./files/bg_olympicparksouth.png",
  "./files/bg_walkerhill.png",
  "./assets/icon-192.png",
  "./assets/icon-512.png"
];


self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) =>
        cache.addAll(APP_SHELL)
      )
      .then(() =>
        self.skipWaiting()
      )
  );
});


self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName !== CACHE_NAME
            )
            .map(
              (cacheName) =>
                caches.delete(cacheName)
            )
        )
      )
      .then(() =>
        self.clients.claim()
      )
  );
});


self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  /*
   * GitHub Release MP4 등 외부 origin은 Service Worker가
   * 가로채지 않습니다.
   */
  if (
    url.origin !== self.location.origin
  ) {
    return;
  }

  /*
   * 데이터 파일은 브라우저의 일반 HTTP 캐시 정책에 맡기고
   * Service Worker Cache Storage에는 넣지 않습니다.
   */
  if (
    url.pathname.endsWith(".csv") ||
    url.pathname.endsWith(".json.gz") ||
    url.pathname.endsWith(".gz") ||
    url.pathname.endsWith(".mp4")
  ) {
    return;
  }

  /*
   * network-first
   *
   * 1. GitHub Pages에서 최신 파일 요청
   * 2. 성공하면 캐시 갱신
   * 3. 네트워크 오류일 때만 기존 캐시 사용
   */
  event.respondWith(
    fetch(request)
      .then((response) => {
        if (
          response &&
          response.ok
        ) {
          const cloned =
            response.clone();

          caches
            .open(CACHE_NAME)
            .then((cache) => {
              cache.put(
                request,
                cloned
              );
            });
        }

        return response;
      })
      .catch(async () => {
        const cached =
          await caches.match(request);

        if (cached) {
          return cached;
        }

        /*
         * navigation 요청이면 index.html fallback
         */
        if (
          request.mode === "navigate"
        ) {
          return (
            await caches.match(
              "./index.html"
            )
          );
        }

        throw new Error(
          "Network request failed and no cache exists."
        );
      })
  );
});


self.addEventListener(
  "notificationclick",
  (event) => {
    event.notification.close();

    const targetUrl =
      event.notification.data?.url ||
      new URL(
        "./#/",
        self.registration.scope
      ).href;

    event.waitUntil(
      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })
        .then(async (clients) => {
          /*
           * 이미 열린 앱 창이 있으면 그 창을 재사용합니다.
           */
          if (clients.length > 0) {
            const client =
              clients[0];

            if (
              "navigate" in client
            ) {
              await client.navigate(
                targetUrl
              );
            }

            if (
              "focus" in client
            ) {
              await client.focus();
            }

            return;
          }

          /*
           * 열린 창이 없으면 새 창을 엽니다.
           */
          if (
            self.clients.openWindow
          ) {
            await self.clients.openWindow(
              targetUrl
            );
          }
        })
    );
  }
);
