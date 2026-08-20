import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import "./prototype.css";
import { AuthProvider } from "./components/moyeobap/AuthProvider";
import { Header } from "./components/moyeobap/Header";

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
        { url: "/icon.png", type: "image/png" },
        { url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🍚</text></svg>", type: "image/svg+xml" },
      ],
      apple: "/icon.png",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html data-scroll-behavior="smooth" lang="ko">
      <body>
        <AuthProvider>
          <div className="moyeobap-body">
            <div className="app">
              <Header />
              {children}
            </div>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
