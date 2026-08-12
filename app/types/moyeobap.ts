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
  participants: User[];
  status: 'active' | 'closed' | 'failed';
  /** 정원. 없으면 인원 제한 없이 마감 시간까지만 모집합니다. */
  maxParticipants: number | null;
}

export interface ToastNotice {
  message: string;
  type: 'success' | 'warning' | 'error';
}
