import Link from 'next/link';
import { PhoneRoom } from '../../../components/moyeobap/PhoneRoom';

export default async function PhoneRoomPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>갈틱폰</h1>
        </div>
        <Link className="page-back-link" href="/games/phone">← 로비로</Link>
      </div>

      <PhoneRoom roomId={id} />
    </main>
  );
}
