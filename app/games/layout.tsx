import { notFound } from "next/navigation";
import { isFeatureEnabled } from "../lib/featureFlags";

// /games 이하 모든 경로(로비, 오목, 퐁, 플래피 버드, 랭킹 페이지 등)를
// 한 번에 감싸서, games_hub 플래그가 꺼져 있으면 헤더에서 숨긴 것과
// 별개로 URL을 직접 입력해도 접근할 수 없게 막습니다.
export default async function GamesLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isFeatureEnabled("games_hub");
  if (!enabled) notFound();
  return children;
}
