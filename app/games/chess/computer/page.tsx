import type { Metadata } from 'next';
import Link from 'next/link';
import { ChessGame } from '../../../components/moyeobap/ChessGame';

export const metadata: Metadata = {
  title: '체스 컴퓨터 | 모여밥',
  description: '마감까지 기다리는 동안 컴퓨터와 체스 한 판',
};

export default function ChessPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>체스 컴퓨터</h1>
          <p>5단계 난이도의 컴퓨터와 두고, 난이도별 랭킹에 도전하세요.</p>
        </div>
        <Link className="page-back-link" href="/games/chess">← 체스</Link>
      </div>

      <ChessGame />
    </main>
  );
}
