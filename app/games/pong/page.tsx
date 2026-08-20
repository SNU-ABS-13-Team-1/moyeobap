import Link from 'next/link';
import { PongLobby } from '../../components/moyeobap/PongLobby';

export default function PongLobbyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🏓 PONG</h1>
          <p>다른 사람과 실시간으로 Pong을 대전해보세요.</p>
        </div>
        <Link className="page-back-link" href="/games">← 미니게임</Link>
      </div>

      <PongLobby />
    </main>
  );
}
