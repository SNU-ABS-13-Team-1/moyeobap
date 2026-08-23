import Link from 'next/link';
import { RummyRanking } from '../../../components/moyeobap/RummyRanking';

export default function RummyRankingPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">온라인 대전</p>
          <h1>🏆 루미큐브 랭킹</h1>
          <p>이기면 상대들의 남은 타일 벌점 합을 받고, 지면 내 벌점만큼 잃어요. 누적 점수 순입니다.</p>
        </div>
        <Link className="page-back-link" href="/games/rummy/online">← 로비로</Link>
      </div>

      <RummyRanking />
    </main>
  );
}
