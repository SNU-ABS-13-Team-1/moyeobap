import Link from 'next/link';
import { RhythmGame } from '../../components/moyeobap/RhythmGame';

export default function RhythmPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>정밀 노트 리듬게임</h1>
          <p>마감까지 기다리는 동안 가볍게 즐겨보세요.</p>
        </div>
        <Link className="page-back-link" href="/games">← 미니게임</Link>
      </div>

      <RhythmGame />
    </main>
  );
}
