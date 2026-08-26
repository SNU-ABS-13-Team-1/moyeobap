import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OneNightRoom } from '../../../components/moyeobap/OneNightRoom';
import { isFeatureEnabled } from '../../../lib/featureFlags';

export default async function OneNightRoomPage({ params }: { params: Promise<{ id: string }> }) {
  if (!(await isFeatureEnabled('onenight'))) notFound();
  const { id } = await params;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>원나잇 인랑</h1>
        </div>
        <Link className="page-back-link" href="/games/onenight">← 로비로</Link>
      </div>

      <OneNightRoom roomId={id} />
    </main>
  );
}
