import Link from 'next/link';

const GAMES = [
  {
    href: '/games/snake',
    emoji: '🐍',
    title: '스네이크',
    desc: '방향키로 조작해서 먹이를 먹고 길어지세요.',
  },
  {
    href: '/games/omok',
    emoji: '⚫',
    title: '오목 (실시간 대전)',
    desc: '로비에서 상대를 찾아 실시간으로 오목을 둬보세요.',
  },
  {
    href: '/games/chess',
    emoji: '♟️',
    title: '체스',
    desc: '컴퓨터와 대결하거나 다른 사람과 실시간으로 두세요.',
  },
  {
    href: '/games/rummy',
    emoji: '🀄',
    title: '루미큐브',
    desc: '컴퓨터(5단계)와 두거나 친구들과 온라인으로 2~4명이 겨루세요.',
  },
  {
    href: '/games/flappy',
    emoji: '🐤',
    title: '플래피 버드',
    desc: 'Space/클릭/터치로 flap해서 파이프를 통과하고 콤보를 쌓아보세요.',
  },
] as const;

export default function GamesPage() {
  return (
    <main className="page-content">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">잠깐 쉬어가기</p>
          <h1>미니게임</h1>
          <p>마감까지 기다리는 동안 가볍게 즐겨보세요.</p>
        </div>
        <Link className="page-back-link" href="/">← 현황판으로</Link>
      </div>

      <div className="games-grid">
        {GAMES.map((game) => (
          <Link className="games-grid__card" href={game.href} key={game.href}>
            <span className="games-grid__emoji" aria-hidden="true">{game.emoji}</span>
            <span className="games-grid__title">{game.title}</span>
            <span className="games-grid__desc">{game.desc}</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
