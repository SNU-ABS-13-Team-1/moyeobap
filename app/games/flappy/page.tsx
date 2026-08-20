import Link from 'next/link';
import { FlappyGame } from '../../components/moyeobap/FlappyGame';

export default function FlappyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>플래피 버드</h1>
          <p>마감까지 기다리는 동안 가볍게 즐겨보세요.</p>
        </div>
        <Link className="page-back-link" href="/">← 현황판으로</Link>
      </div>

      <FlappyGame />
    </main>
  );
}
