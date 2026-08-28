// 설치 가능(PWA) 조건을 충족하기 위한 최소 서비스워커입니다. 오목·바둑 같은
// 실시간 대국이 핵심 기능이라 오프라인 캐싱은 일부러 넣지 않았습니다 — 캐시된
// 낡은 화면이 뜨면 지금 대국 상태를 놓친 것처럼 보일 수 있기 때문입니다.
// 푸시 알림을 붙일 때 이 파일에 push/notificationclick 핸들러를 추가합니다.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
