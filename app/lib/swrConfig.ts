import type { SWRConfiguration } from 'swr';

/**
 * 모여밥 서비스 전역에서 일관된 트래픽 관리를 위해 사용하는 SWR 폴링 프리셋입니다.
 * Supabase Egress 및 Vercel Function 호출을 최소화하기 위해
 * 반드시 refreshWhenHidden: false (탭 비활성화 시 폴링 정지)를 포함합니다.
 */
export const POLLING_PRESETS = {
  /**
   * 실시간 게임 룸 (바둑, 체스, 오목, 알까기, 원나잇 인랑, 퐁, 루미큐브, 폰 등)
   * - 주요 상태 변경은 Supabase Realtime으로 즉시 수신하되, 네트워크 순단 fallback으로 8초 폴링을 둡니다.
   */
  GAME_ROOM: {
    refreshInterval: 8000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  } satisfies SWRConfiguration,

  /**
   * 팟 상세 화면 (/pots/[id])
   * - 참여자 변동 및 상태 확인을 위한 10초 폴링
   */
  POT_DETAIL: {
    refreshInterval: 10000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  } satisfies SWRConfiguration,

  /**
   * 메인 팟 목록/현황판 (/)
   * - 12초 폴링
   */
  POT_LIST: {
    refreshInterval: 12000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  } satisfies SWRConfiguration,

  /**
   * 게임 로비 / 열린 방 목록
   * - 8초 폴링
   */
  GAME_LOBBY: {
    refreshInterval: 8000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  } satisfies SWRConfiguration,

  /**
   * 게임 랭킹 / 명예의 전당
   * - 20초 폴링
   */
  GAME_RANKING: {
    refreshInterval: 20000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  } satisfies SWRConfiguration,

  /**
   * 팟 및 게임 채팅 fallback
   * - 6초 폴링
   */
  CHAT_FALLBACK: {
    refreshInterval: 6000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  } satisfies SWRConfiguration,

  /**
   * 내 참여 팟 목록 (/my) 및 알림
   * - 15초 폴링
   */
  USER_HUB: {
    refreshInterval: 15000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 3000,
  } satisfies SWRConfiguration,
} as const;
