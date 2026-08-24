import Link from 'next/link';
import { BadukLobby } from '../../components/moyeobap/BadukLobby';

export default function BadukLobbyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>바둑 (19x19)</h1>
          <p>다른 사람과 실시간으로 바둑을 둬보세요.</p>
        </div>
        <Link className="page-back-link" href="/games">← 미니게임</Link>
      </div>

      <BadukLobby />
    </main>
  );
}
