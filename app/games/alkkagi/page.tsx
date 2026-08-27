import Link from 'next/link';
import { AlkkagiLobby } from '../../components/moyeobap/AlkkagiLobby';

export default function AlkkagiLobbyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🥌 알까기</h1>
          <p>돌을 끌어서 튕겨 상대 돌을 판 밖으로 내보내세요.</p>
        </div>
        <Link className="page-back-link" href="/games">← 미니게임</Link>
      </div>

      <AlkkagiLobby />
    </main>
  );
}
