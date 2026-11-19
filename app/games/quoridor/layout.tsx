import { notFound } from "next/navigation";
import { isFeatureEnabled } from "../../lib/featureFlags";

// /games/quoridor 이하 모든 경로(로비, 대전방, 랭킹)를 quoridor 플래그로 감쌉니다.
// 테스트 서버 없이 운영에 바로 적용하므로, 플래그를 켜기 전까지는 아무에게도 보이지 않습니다.
// isFeatureEnabled는 조회 실패 시 false를 돌려주므로(fail-closed) 마이그레이션 전에도 노출되지 않습니다.
export default async function QuoridorLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isFeatureEnabled("quoridor");
  if (!enabled) notFound();
  return children;
}
