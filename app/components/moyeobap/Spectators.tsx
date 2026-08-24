'use client';

// 방에 접속해 있는 관전자 이름 표시(모든 게임 공용). 4명까지 이름을 보여주고 나머지는 "외 n명".
export function Spectators({ names, className = 'omok-room__spectators' }: { names: string[]; className?: string }) {
  if (names.length === 0) return null;
  const shown = names.slice(0, 4);
  const rest = names.length - shown.length;
  return (
    <span className={className} title={names.join(', ')}>
      👀 관전 {names.length}명 · {shown.join(', ')}
      {rest > 0 ? ` 외 ${rest}명` : ''}
    </span>
  );
}
