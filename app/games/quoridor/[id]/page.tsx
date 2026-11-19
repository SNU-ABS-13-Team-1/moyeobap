import Link from 'next/link';
import { QuoridorRoom } from '../../../components/moyeobap/QuoridorRoom';

export default async function QuoridorRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🧱 쿼리도</h1>
        </div>
        <Link className="page-back-link" href="/games/quoridor">← 로비로</Link>
      </div>

      <QuoridorRoom roomId={id} />
    </main>
  );
}
