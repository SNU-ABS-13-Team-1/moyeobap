import Link from 'next/link';
import { OmokLobby } from '../../components/moyeobap/OmokLobby';

export default function OmokLobbyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>오목</h1>
          <p>다른 사람과 실시간으로 오목을 둬보세요.</p>
        </div>
        <Link className="page-back-link" href="/games">← 미니게임</Link>
      </div>

      <OmokLobby />
    </main>
  );
}
