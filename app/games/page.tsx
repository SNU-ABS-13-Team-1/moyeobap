import Link from 'next/link';
import { OpenRoomsPanel } from '../components/moyeobap/OpenRoomsPanel';
import { isFeatureEnabled } from '../lib/featureFlags';

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
    href: '/games/alkkagi',
    emoji: '🥌',
    title: '알까기',
    desc: '돌을 끌어서 튕겨 상대 돌을 판 밖으로 내보내세요. 5개씩, 먼저 다 떨어뜨리면 승리.',
    flag: 'alkkagi',
  },
  {
    href: '/games/baduk',
    emoji: '⚫⚪',
    title: '바둑',
    desc: '정식 크기 바둑판에서 다른 사람과 실시간으로 대국하세요.',
    flag: 'baduk',
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
    href: '/games/phone',
    emoji: '📞',
    title: '갈틱폰',
    desc: '문장 → 그림 → 문장… 전화 게임. 3~10명이 동시에 쓰고 그린 뒤 앨범을 같이 봐요.',
  },
  {
    href: '/games/onenight',
    emoji: '🌙',
    title: '원나잇 인랑',
    desc: '밤 한 번, 낮 한 번. 카드를 받고 한 명을 지목하면 끝나는 짧은 마피아 (3~8명).',
    flag: 'onenight',
  },
  {
    href: '/games/flappy',
    emoji: '🐤',
    title: '플래피 버드',
    desc: 'Space/클릭/터치로 flap해서 파이프를 통과하고 콤보를 쌓아보세요.',
  },
] as const;

export default async function GamesPage() {
  // 플래그가 붙은 게임만 DB를 확인합니다(바둑·알까기처럼 테스트서버에서 먼저
  // 검증 중인 것들). 플래그가 없는 게임은 그대로 모두에게 보입니다.
  type Flag = Extract<(typeof GAMES)[number], { flag: string }>['flag'];
  const flags = [...new Set(GAMES.flatMap((game) => ('flag' in game ? [game.flag] : [])))];
  const enabled = new Set<Flag>(
    (await Promise.all(flags.map(async (flag) => ((await isFeatureEnabled(flag)) ? flag : null))))
      .filter((flag): flag is Flag => flag !== null),
  );
  const games = GAMES.filter((game) => !('flag' in game) || enabled.has(game.flag));

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
        {games.map((game) => (
          <Link className="games-grid__card" href={game.href} key={game.href}>
            <span className="games-grid__emoji" aria-hidden="true">{game.emoji}</span>
            <span className="games-grid__title">{game.title}</span>
            <span className="games-grid__desc">{game.desc}</span>
          </Link>
        ))}
      </div>

      <OpenRoomsPanel />
    </main>
  );
}
