import Link from 'next/link';
import { OmokRoom } from '../../../components/moyeobap/OmokRoom';

export default async function OmokRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>오목</h1>
        </div>
        <Link className="page-back-link" href="/games/omok">← 로비로</Link>
      </div>

      <OmokRoom roomId={id} />
    </main>
  );
}
