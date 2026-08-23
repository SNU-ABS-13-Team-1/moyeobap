import Link from 'next/link';
import { RummyRoom } from '../../../../components/moyeobap/RummyRoom';

export default async function RummyRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">온라인 대전</p>
          <h1>루미큐브</h1>
        </div>
        <Link className="page-back-link" href="/games/rummy/online">← 로비로</Link>
      </div>

      <RummyRoom roomId={id} />
    </main>
  );
}
