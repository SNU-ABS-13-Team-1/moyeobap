import type { Metadata } from 'next';
import Link from 'next/link';
import { PhoneLobby } from '../../components/moyeobap/PhoneLobby';

export const metadata: Metadata = { title: '갈틱폰 | 모여밥' };

export default function PhoneLobbyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>갈틱폰</h1>
          <p>문장을 쓰면 다른 사람이 그림으로 옮기고, 그 그림을 또 다른 사람이 문장으로 설명해요. 처음 문장이 어디까지 망가지는지 다 같이 구경하는 게임(3~10명, 4명 이상 추천).</p>
        </div>
        <Link className="page-back-link" href="/games">← 미니게임으로</Link>
      </div>

      <PhoneLobby />
    </main>
  );
}
