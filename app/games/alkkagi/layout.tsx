import { notFound } from "next/navigation";
import { isFeatureEnabled } from "../../lib/featureFlags";

// /games/alkkagi 이하 모든 경로(로비, 대전방, 랭킹)를 games_hub와 별개인
// alkkagi 플래그로 감쌉니다. 다른 미니게임은 실서버에 공개돼 있어도 방금
// 만든 알까기는 테스트서버 DB에서만 켜서 먼저 검증하기 위해서입니다.
// isFeatureEnabled는 조회 실패 시 false를 돌려주므로(fail-closed), 플래그
// 마이그레이션을 아직 적용하지 않은 DB에서도 노출되지 않습니다.
export default async function AlkkagiLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isFeatureEnabled("alkkagi");
  if (!enabled) notFound();
  return children;
}
