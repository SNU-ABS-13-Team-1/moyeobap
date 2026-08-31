import { notFound } from "next/navigation";
import { isFeatureEnabled } from "../../lib/featureFlags";

// /games/rhythm 이하 경로를 games_hub와 별개인 rhythm 플래그로 감쌉니다.
// 다른 미니게임은 실서버에 공개돼 있어도 방금 만든 리듬게임(실제 BGM
// 채보)만 테스트서버에서 먼저 검증하기 위해서입니다. isFeatureEnabled는
// 조회 실패 시 false를 돌려주므로(fail-closed), 플래그 마이그레이션을
// 아직 적용하지 않은 DB에서도 노출되지 않습니다.
export default async function RhythmLayout({ children }: { children: React.ReactNode }) {
  const enabled = await isFeatureEnabled("rhythm");
  if (!enabled) notFound();
  return children;
}
