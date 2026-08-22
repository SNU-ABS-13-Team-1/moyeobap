import Link from 'next/link';
import { ChessRanking } from '../../../components/moyeobap/ChessRanking';

export default function ChessRankingPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🏆 체스 랭킹</h1>
          <p>대국 결과에 따라 ELO Rating이 오르내려요.</p>
        </div>
        <Link className="page-back-link" href="/games/chess/online">← 로비로</Link>
      </div>

      <ChessRanking />
    </main>
  );
}
