'use client';

import { GameRanking } from './GameRanking';

export function QuoridorRanking() {
  return <GameRanking apiRanking="/api/games/quoridor/ranking" />;
}
