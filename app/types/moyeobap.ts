export interface Menu {
  name: string;
  price: string;
}

export interface Restaurant {
  id: string;
  name: string;
  emoji: string;
  category: 'lunch' | 'cafe';
  /** 배민 소분류 14종(한식/중식/찜·탕/족발·보쌈/카페·디저트 등, data/DATA_GUIDE.md 참고). 목록 그룹핑용. 직접 추가한 매장은 없을 수 있습니다. */
  subCategory?: string;
  minOrder: number;
  deliveryTime: string;
  menus: Menu[];
  /** 데이터팀 조사 매장은 채워져 있고, 사용자가 직접 추가한 매장은 비어 있을 수 있습니다. */
  address?: string;
  phone?: string;
  businessHours?: string;
  closedDays?: string;
  rating?: number;
  /** 목록에 없어서 사용자가 방 만들 때 직접 추가한 매장인지 여부. */
  isCustom?: boolean;
}

export interface User {
  id: string;
  name: string;
  initial: string;
  /** 선택 입력. 채팅방에서 "계좌번호 전송" 버튼을 누르면 이 값을 그대로 공유합니다. */
  bankAccount?: string;
}

export interface ChatMessage {
  id: string;
  potId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  /** 'account'면 계좌번호 공유 메시지 — 채팅에서 살짝 다르게 표시합니다. */
  kind?: 'text' | 'account';
}

export interface Pot {
  id: string;
  restaurantId: string;
  deadline: Date;
  /** 전체 참여 인원수. 신원과 무관하게 누구에게나 보이는 값. */
  participantCount: number;
  /**
   * 참여자 신원은 그 팟 참여자끼리만 볼 수 있어서(AGENTS.md 6장), 서버는
   * 내가 참여한 팟에만 이 배열을 채워 보냅니다. 비참여자에게는 빈 배열.
   * 계좌번호는 어떤 응답에도 실리지 않습니다.
   */
  participants: User[];
  status: 'active' | 'closed' | 'failed';
  /** 정원. 없으면 인원 제한 없이 마감 시간까지만 모집합니다. */
  maxParticipants: number | null;
}

export interface ToastNotice {
  message: string;
  type: 'success' | 'warning' | 'error';
}

/**
 * 행동/Event 데이터 — 사용자가 서비스를 쓰면서 쌓이는 기록.
 * 모집 현황(실시간 상태 데이터)은 마감되면 값이 사라지지만, 이 기록은 남아
 * 인기 매장·성공률 같은 정보로 다시 쓰인다.
 * 자세한 배경은 docs/DATA_CATEGORIES.md 참고.
 */
export type PotEventType =
  | 'pot_created'
  | 'pot_joined'
  | 'pot_left'
  | 'pot_closed'
  | 'pot_failed';

export interface PotEvent {
  id: string;
  type: PotEventType;
  potId: string;
  restaurantId: string;
  /** 행동을 한 사람. 마감·실패는 시간이나 정원 때문에 자동으로 일어나므로 비어 있다. */
  userId?: string;
  /** 이 사건 직후의 참여 인원. 성공률과 평균 모집 규모를 낼 때 쓴다. */
  participantCount: number;
  createdAt: string;
}

/**
 * 목록 상단 탭. 'closed'는 마감된 팟만 모아 보는 탭이다.
 * 나머지 탭에는 진행 중인 팟만 나온다 — 마감된 팟이 쌓이면 목록이 길어져
 * 지금 참여할 수 있는 팟을 찾기 어려워지기 때문이다.
 * (인원 미달로 실패한 팟은 서버가 목록에서 빼므로 여기에도 오지 않는다.)
 */
export type PotFilter = 'all' | 'lunch' | 'cafe' | 'closed';
