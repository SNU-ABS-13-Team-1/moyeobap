import { notFound } from "next/navigation";
import { isFeatureEnabled } from "../../lib/featureFlags";

// /games/baduk 이하 모든 경로(로비, 대국방, 랭킹)를 games_hub와 별개인
// baduk 플래그로 감쌉니다. 다른 미니게임은 실서버에 공개돼 있어도 방금
// 만든 바둑은 테스트서버 DB에서만 켜서 먼저 검증하기 위해서입니다.
export default async function BadukLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isFeatureEnabled("baduk");
  if (!enabled) notFound();
  return children;
}
