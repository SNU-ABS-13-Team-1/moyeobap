export type CafeMenu = {
  id: string;
  name: string;
  price: number;
  visual: string;
  popular?: boolean;
};

export type Cafe = {
  id: string;
  name: string;
  location: string;
  badge: string;
  visual: string;
  tone: string;
  menus: CafeMenu[];
};

export const INITIAL_CAFES: Cafe[] = [
  {
    id: "cafe_001",
    name: "메가MGC커피 배곧한라비발디점",
    location: "시흥캠 도보 5분 / 배곧한라비발디 1차 상가",
    badge: "🔥 시흥캠 인기 1위",
    visual: "☕",
    tone: "amber",
    menus: [
      { id: "m_mega_1", name: "아이스 아메리카노", price: 2000, visual: "🧊☕", popular: true },
      { id: "m_mega_2", name: "아샷추 (아이스티+샷추가)", price: 3000, visual: "🍑☕", popular: true },
      { id: "m_mega_3", name: "할메가커피", price: 1900, visual: "👵☕" },
      { id: "m_mega_4", name: "플레인 퐁크러쉬", price: 3900, visual: "🥛🌾", popular: true },
      { id: "m_mega_5", name: "큐브라떼", price: 4200, visual: "🧊🥛" },
      { id: "m_mega_6", name: "감자빵 / 감자 크로플", price: 3500, visual: "🥔🥐" },
    ],
  },
  {
    id: "cafe_002",
    name: "스타벅스 시흥배곧점",
    location: "배곧 중심상가",
    badge: "⭐ 시동/연구모임 단골",
    visual: "🟢",
    tone: "emerald",
    menus: [
      { id: "m_sb_1", name: "아이스 자몽 허니 블랙 티 (자허블)", price: 5700, visual: "🍹", popular: true },
      { id: "m_sb_2", name: "아이스 카페 라떼", price: 5000, visual: "🥛☕" },
      { id: "m_sb_3", name: "스타벅스 돌체 라떼", price: 5900, visual: "🍯☕", popular: true },
      { id: "m_sb_4", name: "아이스 아메리카노 (Grand)", price: 5000, visual: "🧊☕" },
      { id: "m_sb_5", name: "부드러운 생크림 카스텔라", price: 4500, visual: "🍰" },
    ],
  },
  {
    id: "cafe_003",
    name: "컴포즈커피 배곧테크노밸리점",
    location: "배곧 테크노밸리 1층",
    badge: "⚡ 가성비 최강",
    visual: "🟡",
    tone: "yellow",
    menus: [
      { id: "m_comp_1", name: "아이스 아메리카노", price: 1500, visual: "🧊☕", popular: true },
      { id: "m_comp_2", name: "아인슈페너", price: 4200, visual: "🍦☕", popular: true },
      { id: "m_comp_3", name: "리얼초코 라떼", price: 3500, visual: "🍫🥛" },
      { id: "m_comp_4", name: "사과생크림 와플", price: 3000, visual: "🧇", popular: true },
      { id: "m_comp_5", name: "벨지움 생초콜릿 라떼", price: 4500, visual: "🍫☕" },
    ],
  },
  {
    id: "cafe_004",
    name: "더벤티 시흥배곧한라점",
    location: "배곧한라 2차 단지상가",
    badge: "🥤 대용량 음료 전문",
    visual: "🟣",
    tone: "purple",
    menus: [
      { id: "m_venti_1", name: "아이스 아메리카노 (Venti)", price: 1800, visual: "🧊☕", popular: true },
      { id: "m_venti_2", name: "멜팅초코 쉐이크", price: 3900, visual: "🍫🥤" },
      { id: "m_venti_3", name: "코코넛 쉐이킹", price: 4300, visual: "🥥🥛", popular: true },
      { id: "m_venti_4", name: "청포도 에이드", price: 3500, visual: "🍇🍹" },
    ],
  },
  {
    id: "cafe_005",
    name: "빽다방 배곧한라점",
    location: "배곧한라비발디 상가 1층",
    badge: "🧊 원조 달달커피",
    visual: "🔵",
    tone: "blue",
    menus: [
      { id: "m_paik_1", name: "원조커피 (아이스)", price: 2500, visual: "🧊🍯", popular: true },
      { id: "m_paik_2", name: "앗!메리카노", price: 2000, visual: "🧊☕" },
      { id: "m_paik_3", name: "완전딸기바나나 빽스치노", price: 3800, visual: "🍓🍌", popular: true },
      { id: "m_paik_4", name: "피스타치오 빽스치노", price: 4500, visual: "🥑🥤" },
    ],
  },
  {
    id: "cafe_006",
    name: "이디야커피 시흥한라비발디점",
    location: "시흥캠 인근 한라비발디",
    badge: "🧋 토피넛라떼 명가",
    visual: "🔵",
    tone: "indigo",
    menus: [
      { id: "m_ediya_1", name: "토피넛 라떼 (아이스)", price: 4200, visual: "🥜☕", popular: true },
      { id: "m_ediya_2", name: "아이스 아메리카노", price: 3200, visual: "🧊☕" },
      { id: "m_ediya_3", name: "복숭아 아이스티", price: 2900, visual: "🍑🍹" },
      { id: "m_ediya_4", name: "허니 카라멜 브레드", price: 4800, visual: "🍞🍯", popular: true },
    ],
  },
];
