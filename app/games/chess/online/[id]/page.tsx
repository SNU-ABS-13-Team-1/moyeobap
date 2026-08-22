import Link from 'next/link';
import { ChessRoom } from '../../../../components/moyeobap/ChessRoom';

export default async function ChessRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>체스</h1>
        </div>
        <Link className="page-back-link" href="/games/chess/online">← 로비로</Link>
      </div>

      <ChessRoom roomId={id} />
    </main>
  );
}
