import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OneNightLobby } from '../../components/moyeobap/OneNightLobby';
import { isFeatureEnabled } from '../../lib/featureFlags';

export const metadata: Metadata = { title: '원나잇 인랑 | 모여밥' };

export default async function OneNightLobbyPage() {
  if (!(await isFeatureEnabled('onenight'))) notFound();

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>원나잇 인랑</h1>
          <p>카드를 한 장씩 받고, 밤 사이 누군가 그 카드를 몰래 바꿔 놓아요. 한 명을 지목하면 끝나는 짧은 마피아(3~8명, 5명 추천).</p>
        </div>
        <Link className="page-back-link" href="/games">← 미니게임으로</Link>
      </div>

      <OneNightLobby />
    </main>
  );
}
