import Link from 'next/link';

const GAMES = [
  {
    href: '/games/snake',
    emoji: '🐍',
    title: '스네이크',
    desc: '방향키로 조작해서 먹이를 먹고 길어지세요.',
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
