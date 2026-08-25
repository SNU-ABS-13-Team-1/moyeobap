/**
 * 팟 참여자 목록을 "참여자에게 보여줄 형태"로 바꾸는 순수 모듈입니다.
 *
 * 응답에는 사용자 id를 담지 않습니다(지침 6장: 참여자 신원은 최소한만 공개).
 * 그래서 화면이 스스로 "이 줄이 나인가"를 알 수 없어, 여기서 id로 미리 판정한
 * isMe를 실어 보냅니다. 예전에는 화면이 이름을 비교했는데, 참여자 이름은 참여한
 * 순간에 찍힌 스냅샷이라 프로필에서 이름을 바꾸면 본인 줄을 영영 못 찾았습니다
 * (송금 완료 버튼과 주문 메모 입력칸이 사라지는 버그). 동명이인끼리 서로의 줄이
 * 같이 눌리는 문제도 함께 없앱니다.
 *
 * DB·렌더링에 기대지 않는 순수 함수라 규칙은 여기서만 검증합니다
 * (app/lib/potParticipants.test.ts).
 */
import type { ParticipantProfile } from "../types/moyeobap";

export type ParticipantSource = {
  id: string;
  name: string;
  initial: string;
  isPaid?: boolean;
  orderMemo?: string;
};

export function toParticipantProfiles(
  participants: ParticipantSource[],
  managerId: string | null | undefined,
  currentUserId: string | null,
): ParticipantProfile[] {
  return participants.map((participant) => ({
    name: participant.name,
    initial: participant.initial,
    isManager: participant.id === managerId,
    isMe: currentUserId !== null && participant.id === currentUserId,
    isPaid: Boolean(participant.isPaid),
    orderMemo: participant.orderMemo || undefined,
  }));
}
