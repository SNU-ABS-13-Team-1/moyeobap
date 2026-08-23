import type { Metadata } from 'next';
import Link from 'next/link';
import { RummyLobby } from '../../../components/moyeobap/RummyLobby';

export const metadata: Metadata = { title: '루미큐브 온라인 대전 | 모여밥' };

export default function RummyLobbyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">온라인 대전</p>
          <h1>루미큐브</h1>
          <p>방을 만들고 친구를 초대하세요(2~4명). 시작된 방은 관전할 수 있어요.</p>
        </div>
        <Link className="page-back-link" href="/games/rummy">← 루미큐브</Link>
      </div>

      <RummyLobby />
    </main>
  );
}
