export interface Menu {
  name: string;
  price: string;
}

export interface Restaurant {
  id: string;
  name: string;
  emoji: string;
  category: 'lunch' | 'cafe';
  /** 배민 소분류(한식/중식/일식/양식/치킨/피자/족발/보쌈/카페/디저트 등). 목록 그룹핑용. 직접 추가한 매장은 없을 수 있습니다. */
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

export interface ChatMessageView {
  id: string;
  authorName: string;
  text: string;
  createdAt: string;
  kind?: 'text' | 'account';
  isMine: boolean;
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
  /** 정원. 없으면 인원 제한 없이 마감 시간까지만 모집합니다. */
  maxParticipants: number | null;
}

export type SerializedPot = Omit<Pot, 'deadline'> & { deadline: string };

export interface ToastNotice {
  message: string;
  type: 'success' | 'warning' | 'error';
}
