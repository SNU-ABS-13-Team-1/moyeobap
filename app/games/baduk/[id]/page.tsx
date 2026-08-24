import Link from 'next/link';
import { BadukRoom } from '../../../components/moyeobap/BadukRoom';

export default async function BadukRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">실시간 대전</p>
          <h1>바둑</h1>
        </div>
        <Link className="page-back-link" href="/games/baduk">← 로비로</Link>
      </div>

      <BadukRoom roomId={id} />
    </main>
  );
}
