'use client';

import { GameRanking } from './GameRanking';

export function BadukRanking() {
  return <GameRanking apiRanking="/api/games/baduk/ranking" />;
}
