import type { SWRConfiguration } from 'swr';

/**
 * 모여밥 서비스 전역에서 일관된 트래픽 관리를 위해 사용하는 SWR 폴링 프리셋입니다.
 * Supabase Egress 및 Vercel Function 호출을 최소화하기 위해
 * 반드시 refreshWhenHidden: false (탭 비활성화 시 폴링 정지)를 포함합니다.
 */
export const POLLING_PRESETS = {
  /**
   * 실시간 게임 룸 (바둑, 체스, 오목, 알까기, 원나잇 인랑, 퐁, 루미큐브, 폰 등)
   * - 주요 상태 변경은 Supabase Realtime으로 즉시 수신하되, 네트워크 순단 fallback으로 20초 폴링을 둡니다.
   */
  GAME_ROOM: {
    refreshInterval: 20000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 3000,
  } satisfies SWRConfiguration,

  /**
   * 팟 상세 화면 (/pots/[id])
   * - 참여자 변동 및 상태 확인을 위한 25초 폴링
   */
  POT_DETAIL: {
    refreshInterval: 25000,
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
   * - 주간 랭킹은 실시간으로 바뀌지 않으므로 상시 폴링을 끄고(0), 진입 시 1회만 조회합니다.
   */
  GAME_RANKING: {
    refreshInterval: 0,
    refreshWhenHidden: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 60000,
  } satisfies SWRConfiguration,

  /**
   * 팟 및 게임 채팅 fallback
   * - 30초 폴링
   */
  CHAT_FALLBACK: {
    refreshInterval: 30000,
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

/** 연결 장애 때만 쓰는 제한된 재연결 대기 시간입니다. 상시 폴링이 아닙니다. */
export const GAME_ROOM_RECOVERY_DELAYS = [1000, 3000, 10000] as const;
