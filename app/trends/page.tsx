import type { Metadata } from "next";
import { TrendsPageClient } from "@/app/components/moyeobap/TrendsPageClient";

export const metadata: Metadata = {
  title: "식사 트렌드 & 맛집 랭킹 | 모여밥",
  description: "모여밥 캠퍼스 식사 트렌드, 피크 타임, 인기 맛집 랭킹 및 성사 지표 리포트",
};

export default function TrendsPage() {
  return <TrendsPageClient />;
}
