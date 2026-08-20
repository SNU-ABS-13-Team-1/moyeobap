import Link from 'next/link';
import { PongRoom } from '../../../components/moyeobap/PongRoom';

export default async function PongRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🏓 PONG</h1>
        </div>
        <Link className="page-back-link" href="/games/pong">← 로비로</Link>
      </div>

      <PongRoom roomId={id} />
    </main>
  );
}
