import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: '체스 | 모여밥' };

// 체스 입구: 컴퓨터와 대결할지, 다른 사람과 실시간으로 둘지 고르는 화면입니다.
const MODES = [
  {
    href: '/games/chess/computer',
    emoji: '🤖',
    title: '컴퓨터와 대결',
    desc: '완전 초보부터 프로까지 5단계. 랭킹 없이 편하게 연습하세요.',
  },
  {
    href: '/games/chess/online',
    emoji: '♞',
    title: '실시간 대전',
    desc: '로비에서 상대를 찾아 실시간으로 두세요. 관전·채팅·시간제 선택, ELO 랭킹.',
  },
] as const;

export default function ChessHomePage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>체스</h1>
          <p>어떻게 둘지 골라주세요.</p>
        </div>
        <Link className="page-back-link" href="/games">← 미니게임으로</Link>
      </div>

      <div className="games-grid games-grid--wide">
        {MODES.map((mode) => (
          <Link className="games-grid__card" href={mode.href} key={mode.href}>
            <span className="games-grid__emoji" aria-hidden="true">{mode.emoji}</span>
            <span className="games-grid__title">{mode.title}</span>
            <span className="games-grid__desc">{mode.desc}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
