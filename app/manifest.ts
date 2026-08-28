import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "모여밥 | 시흥캠퍼스 공동주문 현황",
    short_name: "모여밥",
    description:
      "모집 마감 시간과 참여 인원을 확인하고 원하는 음식점의 공동주문에 참여하는 시흥캠퍼스 실시간 현황판",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#F8FAFC",
    theme_color: "#FF6B35",
    lang: "ko",
    // 아이콘이 캔버스 가장자리까지 꽉 차 있어 maskable 안전 영역이 없습니다.
    // "maskable"로 선언하면 안드로이드가 원형/둥근사각형으로 자를 때 밥그릇
    // 위아래가 잘려나가므로, 지금은 "any"만 씁니다. 마스크에 안전한 여백을
    // 둔 아이콘을 새로 만들면 그때 maskable을 추가합니다.
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
