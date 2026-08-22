import { Chess } from 'chess.js';
import { pickCpuMove, type Difficulty } from './chessAi';

// 고수·프로 난이도의 탐색은 1~2초 걸릴 수 있어 화면이 멈추지 않도록 Web Worker에서 돌립니다.
// 메인 화면은 { id, fen, difficulty }를 보내고 { id, move }를 받습니다.

export type ChessAiRequest = { id: number; fen: string; difficulty: Difficulty };
export type ChessAiResponse = { id: number; move: { from: string; to: string; promotion?: string } | null };

self.onmessage = (event: MessageEvent<ChessAiRequest>) => {
  const { id, fen, difficulty } = event.data;
  let move: ChessAiResponse['move'] = null;
  try {
    const picked = pickCpuMove(new Chess(fen), difficulty);
    if (picked) move = { from: picked.from, to: picked.to, promotion: picked.promotion };
  } catch {
    move = null;
  }
  const response: ChessAiResponse = { id, move };
  self.postMessage(response);
};
