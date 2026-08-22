import type { Metadata } from 'next';
import Link from 'next/link';
import { ChessGame } from '../../components/moyeobap/ChessGame';

export const metadata: Metadata = {
  title: '체스 | 모여밥',
  description: '마감까지 기다리는 동안 컴퓨터와 체스 한 판',
};

export default function ChessPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>체스</h1>
          <p>마감까지 기다리는 동안 가볍게 즐겨보세요.</p>
        </div>
        <div className="chess-page__links">
          <Link className="page-back-link" href="/games/chess/online">♞ 실시간 대전 로비 →</Link>
          <Link className="page-back-link" href="/games">← 미니게임으로</Link>
        </div>
      </div>

      <ChessGame />
    </main>
  );
}
