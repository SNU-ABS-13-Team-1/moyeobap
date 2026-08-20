import Link from 'next/link';
import { OmokRanking } from '../../../components/moyeobap/OmokRanking';

export default function OmokRankingPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🏆 오목 랭킹</h1>
          <p>대국 결과에 따라 ELO Rating이 오르내려요.</p>
        </div>
        <Link className="page-back-link" href="/games/omok">← 로비로</Link>
      </div>

      <OmokRanking />
    </main>
  );
}
