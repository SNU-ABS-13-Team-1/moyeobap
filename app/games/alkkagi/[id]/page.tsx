import Link from 'next/link';
import { AlkkagiRoom } from '../../../components/moyeobap/AlkkagiRoom';

export default async function AlkkagiRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>🥌 알까기</h1>
        </div>
        <Link className="page-back-link" href="/games/alkkagi">← 로비로</Link>
      </div>

      <AlkkagiRoom roomId={id} />
    </main>
  );
}
