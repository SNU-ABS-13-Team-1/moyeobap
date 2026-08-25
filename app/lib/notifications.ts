/**
 * 알림 판정 로직. DB나 브라우저 API에 기대지 않는 순수 함수라 테스트가 붙습니다.
 *
 * 새 팟은 서버 폴링으로, 채팅은 Realtime으로 들어옵니다(pots는 클라이언트에
 * SELECT가 열려 있지 않아 구독할 수 없습니다). 두 경로가 다를 뿐, 무엇을
 * 알릴지 정하는 규칙은 여기 한 곳에 모읍니다.
 */

export type NewPotCandidate = {
  id: string;
  createdAt: string;
  creatorId: string;
  status: "active" | "closed" | "failed";
  deadline: string;
};

export type SelectNewPotsParams = {
  userId: string;
  /** 사용자가 현황판을 마지막으로 본 시각. 기록이 없으면 null. */
  lastSeenAt: string | null;
  now: Date;
};

/**
 * 알림으로 띄울 새 팟을 최신순으로 고릅니다.
 *
 * lastSeenAt이 없으면 빈 배열입니다 — 처음 온 사람에게 그동안 쌓인 팟을
 * 한꺼번에 쏟아내면 알림이 아니라 소음이 됩니다.
 */
export function selectNewPots<T extends NewPotCandidate>(
  pots: T[],
  { userId, lastSeenAt, now }: SelectNewPotsParams,
): T[] {
  if (!lastSeenAt) return [];
  const seenAt = new Date(lastSeenAt).getTime();
  const nowMs = now.getTime();

  return pots
    .filter((pot) => {
      if (pot.creatorId === userId) return false;
      if (pot.status !== "active") return false;
      if (new Date(pot.deadline).getTime() <= nowMs) return false;
      return new Date(pot.createdAt).getTime() > seenAt;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export type MessageEvent = { potId: string; authorId: string };
export type MessageContext = { userId: string; myPotIds: Set<string> };

/**
 * Realtime으로 받은 메시지를 알릴지 정합니다.
 *
 * 구독 자체를 내 팟 id로 걸어두지만, 받은 이벤트도 여기서 한 번 더 거릅니다.
 * 구독 필터나 RLS가 어긋나도 남의 팟 메시지가 화면에 뜨지 않게 하려는 것입니다.
 */
export function shouldNotifyMessage(
  { potId, authorId }: MessageEvent,
  { userId, myPotIds }: MessageContext,
): boolean {
  if (authorId === userId) return false;
  return myPotIds.has(potId);
}
