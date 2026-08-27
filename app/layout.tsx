import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./prototype.css";
import { AuthProvider } from "./components/moyeobap/AuthProvider";
import { Header } from "./components/moyeobap/Header";
import { TestServerBanner } from "./components/moyeobap/TestServerBanner";
import { NotificationProvider } from "./components/moyeobap/NotificationProvider";
import { NotificationToasts } from "./components/moyeobap/NotificationToasts";
import { isFeatureEnabled } from "./lib/featureFlags";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host =
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000";
  const protocol =
    requestHeaders.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "모여밥 | 시흥캠퍼스 공동주문 현황";
  const description =
    "모집 마감 시간과 참여 인원을 확인하고 원하는 음식점의 공동주문에 참여하는 시흥캠퍼스 실시간 현황판";

  return {
    title,
    description,
    icons: {
      icon: [
        { url: "/icon.svg", type: "image/svg+xml" },
        { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      shortcut: "/icon.svg",
    },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "ko_KR",
      images: [
        {
          url: `${origin}/og-v2.png`,
          width: 1734,
          height: 907,
          alt: "모여밥 — 시흥캠퍼스 실시간 공동주문 현황",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`${origin}/og-v2.png`],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [gamesEnabled, notificationsEnabled] = await Promise.all([
    isFeatureEnabled("games_hub"),
    isFeatureEnabled("notifications"),
  ]);

  const shell = (
    <div className="moyeobap-body">
      <div className="app">
        <Header gamesEnabled={gamesEnabled} />
        {children}
      </div>
    </div>
  );

  return (
    <html data-scroll-behavior="smooth" lang="ko">
      <body>
        <AuthProvider>
          <TestServerBanner />
          {/* 알림이 꺼져 있으면 Provider 자체를 매달지 않습니다 — 폴링도
              Realtime 구독도 시작되지 않습니다. */}
          {notificationsEnabled ? (
            <NotificationProvider>
              {shell}
              <NotificationToasts />
            </NotificationProvider>
          ) : (
            shell
          )}
        </AuthProvider>
      </body>
    </html>
  );
}
