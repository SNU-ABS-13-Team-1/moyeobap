import type { SWRConfiguration } from 'swr';

/**
 * 모여밥 서비스 전역에서 일관된 트래픽 관리를 위해 사용하는 SWR 폴링 프리셋입니다.
 * Supabase Egress 및 Vercel Function 호출을 최소화하기 위해
 * 반드시 refreshWhenHidden: false (탭 비활성화 시 폴링 정지)를 포함합니다.
 */
export const POLLING_PRESETS = {
  /**
   * 실시간 게임 룸 (바둑, 체스, 오목, 알까기, 원나잇 인랑, 퐁, 루미큐브, 폰 등)
   * - 주요 상태 변경은 Supabase Realtime으로 즉시 수신하되, 네트워크 순단 fallback으로 12초 폴링을 둡니다.
   */
  GAME_ROOM: {
    refreshInterval: 12000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 3000,
  } satisfies SWRConfiguration,

  /**
   * 방 상태를 Realtime(postgres_changes)으로 구독하는 게임 룸 (오목, 체스, 바둑) 기본 설정
   * - 탭 비활성화 시 정지(refreshWhenHidden: false) 및 중복 방지
   */
  REALTIME_GAME_ROOM: {
    refreshInterval: 0,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 1500,
  } satisfies SWRConfiguration,

  /**
   * 팟 상세 화면 (/pots/[id])
   * - 참여자 변동 및 상태 확인을 위한 15초 폴링
   */
  POT_DETAIL: {
    refreshInterval: 15000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 4000,
  } satisfies SWRConfiguration,

  /**
   * 메인 팟 목록/현황판 (/)
   * - 20초 폴링
   */
  POT_LIST: {
    refreshInterval: 20000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  } satisfies SWRConfiguration,

  /**
   * 게임 로비 / 열린 방 목록
   * - 15초 폴링
   */
  GAME_LOBBY: {
    refreshInterval: 15000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  } satisfies SWRConfiguration,

  /**
   * 게임 랭킹 / 명예의 전당
   * - 60초 폴링 (랭킹은 자주 안 바뀌므로 Egress 방어를 위해 60초 적용)
   */
  GAME_RANKING: {
    refreshInterval: 60000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 10000,
  } satisfies SWRConfiguration,

  /**
   * 팟 및 게임 채팅 fallback
   * - 10초 폴링
   */
  CHAT_FALLBACK: {
    refreshInterval: 10000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 3000,
  } satisfies SWRConfiguration,

  /**
   * 내 참여 팟 목록 (/my) 및 알림
   * - 25초 폴링
   */
  USER_HUB: {
    refreshInterval: 25000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  } satisfies SWRConfiguration,
} as const;

/**
 * 실시간 대전 게임(오목, 체스, 바둑)을 위한 조건부 스마트 폴링 간격 계산
 * - 상대방 턴일 때: 웹소켓 누락/지연 시에도 즉시 넘어가도록 3.5초 안전망 폴링
 * - 내 턴일 때: 상대가 둘 수 없으므로 0초 (폴링 완전 정지 -> DB Egress 0B)
 * - 관전자: 5초 폴링
 * - 대기 중(waiting): 상대 입장 감지 6초
 * - 대국 종료(finished): 재대국 신청 감지 8초
 */
export function getSmartGameRoomPollingInterval({
  status,
  isMyTurn,
  isSpectator,
}: {
  status?: string;
  isMyTurn: boolean;
  isSpectator: boolean;
}): number {
  if (status === 'playing' || status === 'scoring') {
    if (isMyTurn) return 0; // 내가 생각하는 동안은 DB 요청 0B
    if (isSpectator) return 5000;
    return 3500; // 상대 턴일 때는 최대 3.5초 안에 자동 갱신
  }
  if (status === 'waiting') return 6000;
  if (status === 'finished') return 8000;
  return 10000;
}

