export type OrderPeriod = "lunch" | "cafe";

export type RecruitmentStatus =
  | "open"
  | "handoff-pending"
  | "handoff-complete"
  | "closed"
  | "cancelled";

export type Menu = {
  name: string;
  price: number;
};

export type Restaurant = {
  id: string;
  name: string;
  category: string;
  address: string;
  businessHours: string;
  closedDays: string;
  phone: string;
  rating: number;
  estimatedDelivery: string;
  minimumOrder: number;
  representativeMenus: Menu[];
};

export type Participant = {
  id: string;
  name: string;
  joinedAt: number;
};

export type Recruitment = {
  id: string;
  restaurantId: string;
  period: OrderPeriod;
  deadline: string;
  participants: Participant[];
  managerId: string;
  status: RecruitmentStatus;
};

export const CURRENT_USER: Participant = {
  id: "current-user",
  name: "김모여",
  joinedAt: 0,
};

export const RESTAURANTS: Restaurant[] = [
  {
    id: "jjambbong",
    name: "배곧 짬뽕관",
    category: "중식",
    address: "경기 시흥시 배곧동 (예시 주소)",
    businessHours: "11:00~21:00",
    closedDays: "정보 확인 중",
    phone: "정보 확인 중",
    rating: 4.6,
    estimatedDelivery: "35~45분",
    minimumOrder: 15000,
    representativeMenus: [
      { name: "불향 짬뽕", price: 12000 },
      { name: "찹쌀 탕수육", price: 18000 },
      { name: "고기 짜장", price: 9000 },
    ],
  },
  {
    id: "greenbowl",
    name: "그린보울 샐러드",
    category: "샐러드",
    address: "경기 시흥시 배곧동 (예시 주소)",
    businessHours: "10:30~20:30",
    closedDays: "정보 확인 중",
    phone: "정보 확인 중",
    rating: 4.8,
    estimatedDelivery: "25~35분",
    minimumOrder: 12000,
    representativeMenus: [
      { name: "닭가슴살 웜볼", price: 10500 },
      { name: "연어 포케", price: 12500 },
      { name: "두부 버섯 샐러드", price: 9500 },
      { name: "시저 샐러드", price: 8900 },
    ],
  },
  {
    id: "tokyo-katsu",
    name: "도쿄카츠 배곧점",
    category: "일식",
    address: "경기 시흥시 배곧동 (예시 주소)",
    businessHours: "11:00~21:00",
    closedDays: "정보 확인 중",
    phone: "정보 확인 중",
    rating: 4.5,
    estimatedDelivery: "30~40분",
    minimumOrder: 14000,
    representativeMenus: [
      { name: "등심 돈카츠", price: 12500 },
      { name: "안심 돈카츠", price: 13500 },
      { name: "치즈 돈카츠", price: 14000 },
    ],
  },
  {
    id: "stew",
    name: "오늘의 김치찌개",
    category: "한식",
    address: "경기 시흥시 배곧동 (예시 주소)",
    businessHours: "10:30~20:00",
    closedDays: "일요일",
    phone: "정보 확인 중",
    rating: 4.4,
    estimatedDelivery: "30~45분",
    minimumOrder: 13000,
    representativeMenus: [
      { name: "돼지 김치찌개", price: 12000 },
      { name: "참치 김치찌개", price: 11500 },
      { name: "계란말이", price: 7000 },
    ],
  },
  {
    id: "afternoon-coffee",
    name: "오후커피 로스터스",
    category: "카페",
    address: "경기 시흥시 배곧동 (예시 주소)",
    businessHours: "09:00~20:00",
    closedDays: "정보 확인 중",
    phone: "정보 확인 중",
    rating: 4.7,
    estimatedDelivery: "20~30분",
    minimumOrder: 10000,
    representativeMenus: [
      { name: "아메리카노", price: 4500 },
      { name: "카페라테", price: 5200 },
      { name: "바닐라빈 라테", price: 5800 },
    ],
  },
  {
    id: "studio-bakery",
    name: "스튜디오 베이커리",
    category: "카페",
    address: "경기 시흥시 배곧동 (예시 주소)",
    businessHours: "08:30~19:30",
    closedDays: "월요일",
    phone: "정보 확인 중",
    rating: 4.6,
    estimatedDelivery: "25~35분",
    minimumOrder: 12000,
    representativeMenus: [
      { name: "버터 소금빵", price: 3800 },
      { name: "잠봉뵈르", price: 8500 },
      { name: "바질 토마토 치아바타", price: 7800 },
    ],
  },
];

const USERS: Record<string, Participant> = {
  minji: { id: "minji", name: "박민지", joinedAt: 1 },
  hyunwoo: { id: "hyunwoo", name: "이현우", joinedAt: 2 },
  sujin: { id: "sujin", name: "정수진", joinedAt: 3 },
  doyun: { id: "doyun", name: "최도윤", joinedAt: 4 },
  yuna: { id: "yuna", name: "한유나", joinedAt: 5 },
  jiho: { id: "jiho", name: "문지호", joinedAt: 6 },
};

export const INITIAL_RECRUITMENTS: Recruitment[] = [
  {
    id: "lunch-1",
    restaurantId: "greenbowl",
    period: "lunch",
    deadline: "12:15",
    participants: [USERS.minji, USERS.hyunwoo, USERS.sujin],
    managerId: USERS.minji.id,
    status: "open",
  },
  {
    id: "lunch-2",
    restaurantId: "jjambbong",
    period: "lunch",
    deadline: "12:30",
    participants: [
      USERS.hyunwoo,
      USERS.sujin,
      USERS.doyun,
      USERS.yuna,
      USERS.jiho,
    ],
    managerId: USERS.hyunwoo.id,
    status: "open",
  },
  {
    id: "lunch-3",
    restaurantId: "tokyo-katsu",
    period: "lunch",
    deadline: "12:40",
    participants: [USERS.doyun, USERS.yuna],
    managerId: USERS.doyun.id,
    status: "open",
  },
  {
    id: "cafe-1",
    restaurantId: "afternoon-coffee",
    period: "cafe",
    deadline: "14:20",
    participants: [USERS.minji, USERS.sujin, USERS.yuna, USERS.jiho],
    managerId: USERS.minji.id,
    status: "open",
  },
  {
    id: "cafe-2",
    restaurantId: "studio-bakery",
    period: "cafe",
    deadline: "15:00",
    participants: [USERS.hyunwoo, USERS.doyun],
    managerId: USERS.hyunwoo.id,
    status: "open",
  },
];

export function getRestaurant(restaurantId: string) {
  return RESTAURANTS.find((restaurant) => restaurant.id === restaurantId);
}

export function restaurantsForPeriod(period: OrderPeriod) {
  return RESTAURANTS.filter((restaurant) =>
    period === "cafe"
      ? restaurant.category === "카페"
      : restaurant.category !== "카페",
  );
}
