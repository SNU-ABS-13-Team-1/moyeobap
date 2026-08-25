export interface Menu {
  name: string;
  price: string;
}

export interface Restaurant {
  id: string;
  name: string;
  emoji: string;
  category: 'lunch' | 'cafe' | 'other';
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
  /** 1회성 팟 생성을 위한 일회성 매장인지 여부. 정식 매장 목록에는 노출되지 않습니다. */
  isOneTime?: boolean;
}

export interface User {
  id: string;
  name: string;
  initial: string;
  /** Google 계정 이메일. 계정 식별 정보이며 서비스에서는 수정하지 않습니다. */
  email: string;
  avatarUrl?: string;
  /** 선택 입력. 프로필에서만 수정하며 공개 API 응답에는 포함하지 않습니다. */
  bankName?: string;
  accountNumber?: string;
}

/** 참여자끼리 확인할 수 있는 최소 프로필입니다. 사용자 id·이메일·계좌는 노출하지 않습니다. */
export interface ParticipantProfile {
  name: string;
  initial: string;
  isManager: boolean;
  /** 서버가 id로 판정한 본인 여부. 이름은 참여 시점 스냅샷이라 화면에서 비교하면 안 됩니다. */
  isMe: boolean;
  isPaid?: boolean;
  orderMemo?: string;
}

export interface ChatMessage {
  id: string;
  potId: string;
  authorId: string;
  authorName: string;
  text: string;
  createdAt: string;
  /** 'account'면 계좌번호, 'order_link'면 주문 링크, 'image'면 사진 메시지입니다. */
  kind?: 'text' | 'account' | 'order_link' | 'image';
  imageUrl?: string;
}

export interface ChatMessageView {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
  kind?: 'text' | 'account' | 'order_link' | 'image';
  imageUrl?: string;
  isMine: boolean;
}

export interface ChatMessagePreview {
  authorName: string;
  text: string;
  createdAt: string;
}

export type PotStatus = 'active' | 'closed' | 'failed';

/**
 * 브라우저에 전달하는 모집 정보입니다. 참여자 신원은 현재 사용자가 그 모집에
 * 참여한 경우에만 채워집니다.
 */
export interface Pot {
  id: string;
  restaurantId: string;
  deadline: Date;
  participantCount: number;
  participants: ParticipantProfile[] | null;
  isParticipating: boolean;
  isManaging: boolean;
  status: PotStatus;
  /** 팟 자체의 카테고리(점심/카페/기타). 미지정 시 매장 카테고리를 따릅니다. */
  category?: 'lunch' | 'cafe' | 'other';
  /** 정원. 없으면 인원 제한 없이 마감 시간까지만 모집합니다. */
  maxParticipants: number | null;
  /** 외부 주문까지 실제로 완료한 시각. 모집 마감과는 별개의 상태입니다. */
  orderCompletedAt: string | null;
  /** 상단 고정된 대화 메시지/배민 함께주문 링크입니다. */
  pinnedMessage?: { id: string; authorName: string; text: string } | null;
  /** 참여자에게만 제공되는 최근 채팅 미리보기입니다. */
  latestMessage: ChatMessagePreview | null;
  /** 현재 사용자가 아직 읽지 않은 다른 참여자의 메시지 수입니다. */
  unreadMessageCount: number;
}

export type SerializedPot = Omit<Pot, 'deadline'> & { deadline: string };

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
  | 'pot_deadline_updated'
  | 'pot_closed'
  | 'pot_failed'
  | 'order_completed';

export interface PotEvent {
  id: string;
  type: PotEventType;
  potId: string;
  restaurantId: string;
  /** 행동을 한 사람. 자동 마감·실패면 비어 있고 시간 변경·빠른 마감이면 관리자가 들어간다. */
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
export type PotFilter = 'all' | 'lunch' | 'cafe' | 'other' | 'closed';

/** 시간대별 팟 개설 통계 */
export interface PeakHourStat {
  hour: number;
  label: string;
  count: number;
}

/** 음식 카테고리별 점유율 통계 */
export interface CategoryStat {
  category: string;
  label: string;
  count: number;
  percentage: number;
}

/** 인기 음식점 랭킹 통계 */
export interface TopRestaurantStat {
  restaurantId: string;
  name: string;
  category: string;
  potCount: number;
  participantCount: number;
  successRate: number;
}

/** 밥친구 랭킹 통계 */
export interface DiningMateStat {
  name: string;
  initial: string;
  count: number;
}

/** 전체 캠퍼스 식사 트렌드 통계 */
export interface CampusStats {
  totalPots: number;
  totalCompletedPots: number;
  totalParticipants: number;
  totalSavedDeliveryFee: number;
  avgMatchingMinutes: number;
  fastestMatchingMinutes: number;
  avgParticipantsPerPot: number;
  lunchRatio: number;
  cafeRatio: number;
  peakHours: PeakHourStat[];
  categoryDistribution: CategoryStat[];
  topRestaurants: TopRestaurantStat[];
}

/** 로그인 사용자 개인화 리포트 */
export interface MyStatsReport {
  totalJoinedPots: number;
  totalCompletedPots: number;
  savedDeliveryFee: number;
  topMates: DiningMateStat[];
  favoriteCategory: string;
  favoriteCategoryPercentage: number;
}
