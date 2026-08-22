'use client';

import { GameRanking } from './GameRanking';

export function OmokRanking() {
  return <GameRanking apiRanking="/api/games/omok/ranking" />;
}
