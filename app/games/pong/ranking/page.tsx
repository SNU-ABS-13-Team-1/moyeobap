import Link from 'next/link';
import { PongRanking } from '../../../components/moyeobap/PongRanking';

export default function PongRankingPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🏆 PONG RANKING</h1>
          <p>대전 결과에 따라 ELO Rating이 오르내려요.</p>
        </div>
        <Link className="page-back-link" href="/games/pong">← 로비로</Link>
      </div>

      <PongRanking />
    </main>
  );
}
