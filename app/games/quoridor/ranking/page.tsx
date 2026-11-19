import Link from 'next/link';
import { QuoridorRanking } from '../../../components/moyeobap/QuoridorRanking';

export default function QuoridorRankingPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🏆 쿼리도 랭킹</h1>
          <p>이기면 오르고 지면 내려가는 주간 점수예요. 4인전은 승자가 나머지 셋을 각각 이긴 것으로 계산해요.</p>
        </div>
        <Link className="page-back-link" href="/games/quoridor">← 로비로</Link>
      </div>

      <QuoridorRanking />
    </main>
  );
}
