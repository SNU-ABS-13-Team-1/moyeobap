import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = { title: '루미큐브 | 모여밥' };

// 루미큐브 입구: 컴퓨터와 둘지, 친구들과 온라인으로 둘지 고르는 화면입니다.
const MODES = [
  {
    href: '/games/rummy/computer',
    emoji: '🤖',
    title: '컴퓨터와 대결',
    desc: '완전 초보부터 프로까지 5단계, 컴퓨터 1~3명. 랭킹 없이 편하게 연습하세요.',
  },
  {
    href: '/games/rummy/online',
    emoji: '🀄',
    title: '온라인 대전 (2~4명)',
    desc: '방을 만들어 친구를 초대하세요. 관전·채팅·턴 제한시간, 누적 점수 랭킹.',
  },
] as const;

export default function RummyHomePage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>루미큐브</h1>
          <p>어떻게 둘지 골라주세요. 표준 규칙(타일 106장 · 14장 시작 · 첫 등록 30점)입니다.</p>
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
