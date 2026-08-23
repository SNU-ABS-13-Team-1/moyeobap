import type { Metadata } from 'next';
import Link from 'next/link';
import { RummyGameClient } from '../../../components/moyeobap/RummyGameClient';

export const metadata: Metadata = { title: '루미큐브 컴퓨터 | 모여밥' };

export default function RummyPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>루미큐브 · 컴퓨터와 대결</h1>
          <p>표준 규칙 — 타일 106장, 14장씩 시작, 첫 등록 30점. 난이도 5단계, 컴퓨터 1~3명.</p>
        </div>
        <Link className="page-back-link" href="/games/rummy">← 루미큐브</Link>
      </div>

      <RummyGameClient />
    </main>
  );
}
