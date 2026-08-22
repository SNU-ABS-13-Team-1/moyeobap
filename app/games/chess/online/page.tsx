import type { Metadata } from 'next';
import Link from 'next/link';
import { ChessLobby } from '../../../components/moyeobap/ChessLobby';

export const metadata: Metadata = { title: '체스 실시간 대전 | 모여밥' };

export default function ChessLobbyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>체스</h1>
          <p>다른 사람과 실시간으로 체스를 둬보세요. 관전과 채팅도 할 수 있어요.</p>
        </div>
        <Link className="page-back-link" href="/games/chess">← 체스 컴퓨터</Link>
      </div>

      <ChessLobby />
    </main>
  );
}
