import Link from 'next/link';
import { QuoridorLobby } from '../../components/moyeobap/QuoridorLobby';

export default function QuoridorLobbyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🧱 쿼리도</h1>
          <p>말을 반대편 변까지 먼저 보내세요. 매 턴 한 칸 움직이거나 벽을 세워 남의 길을 막을 수 있어요.</p>
        </div>
        <Link className="page-back-link" href="/games">← 미니게임</Link>
      </div>

      <QuoridorLobby />
    </main>
  );
}
