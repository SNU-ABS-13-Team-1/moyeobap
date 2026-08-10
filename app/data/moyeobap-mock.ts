import { Restaurant, User, Pot } from '../types/moyeobap';

export const RESTAURANTS: Restaurant[] = [
  { id: 'bbq', name: 'BBQ치킨', emoji: '🍗', category: 'lunch', minOrder: 18000, deliveryTime: '35~45분', menus: [{name: '황금올리브치킨', price: '20,900원'}, {name: '자메이카 통다리', price: '19,900원'}, {name: '양념치킨', price: '19,900원'}, {name: '치킨+콜라 세트', price: '22,900원'}] },
  { id: 'dominos', name: '도미노피자', emoji: '🍕', category: 'lunch', minOrder: 20000, deliveryTime: '30~40분', menus: [{name: '포테이토 피자 L', price: '24,900원'}, {name: '슈퍼디럭스 L', price: '29,900원'}, {name: '치즈케이크 피자', price: '22,900원'}, {name: '피자+사이드 세트', price: '28,900원'}] },
  { id: 'momstouch', name: '맘스터치', emoji: '🍔', category: 'lunch', minOrder: 15000, deliveryTime: '25~35분', menus: [{name: '싸이버거', price: '5,400원'}, {name: '불싸이버거', price: '6,200원'}, {name: '치즈싸이버거', price: '6,700원'}, {name: '후라이드+양념 세트', price: '17,900원'}] },
  { id: 'subway', name: '서브웨이', emoji: '🥪', category: 'lunch', minOrder: 14000, deliveryTime: '25~35분', menus: [{name: 'BMT 30cm', price: '9,900원'}, {name: '에그마요 30cm', price: '8,400원'}, {name: '스테이크&치즈', price: '10,900원'}, {name: '쿠키+음료 세트', price: '3,500원'}] },
  { id: 'tteok', name: '엽기떡볶이', emoji: '🌶️', category: 'lunch', minOrder: 16000, deliveryTime: '30~40분', menus: [{name: '엽기떡볶이', price: '14,000원'}, {name: '엽기오뎅', price: '13,000원'}, {name: '중국당면 추가', price: '2,000원'}, {name: '주먹밥', price: '1,500원'}] },
  { id: 'kimbap', name: '김밥천국', emoji: '🍙', category: 'lunch', minOrder: 12000, deliveryTime: '20~30분', menus: [{name: '참치김밥', price: '4,000원'}, {name: '치즈돈까스', price: '8,000원'}, {name: '라볶이', price: '7,000원'}, {name: '제육볶음', price: '8,500원'}] },
  { id: 'starbucks', name: '스타벅스', emoji: '☕', category: 'cafe', minOrder: 15000, deliveryTime: '20~30분', menus: [{name: '아이스 아메리카노', price: '4,500원'}, {name: '카페라떼', price: '5,000원'}, {name: '바닐라 프라푸치노', price: '5,900원'}, {name: '조각 케이크', price: '6,500원'}] },
  { id: 'mega', name: '메가커피', emoji: '🥤', category: 'cafe', minOrder: 10000, deliveryTime: '15~25분', menus: [{name: '아이스 아메리카노', price: '2,000원'}, {name: '카페라떼', price: '3,000원'}, {name: '딸기라떼', price: '4,000원'}, {name: '망고스무디', price: '4,500원'}] },
  { id: 'ediya', name: '이디야커피', emoji: '🫖', category: 'cafe', minOrder: 12000, deliveryTime: '20~30분', menus: [{name: '아이스 아메리카노', price: '3,200원'}, {name: '토피넛라떼', price: '4,500원'}, {name: '민트초코라떼', price: '4,300원'}, {name: '허니자몽티', price: '4,500원'}] },
  { id: 'bsg', name: '백스비어', emoji: '🍺', category: 'lunch', minOrder: 20000, deliveryTime: '35~45분', menus: [{name: '양념치킨', price: '18,000원'}, {name: '간장치킨', price: '18,000원'}, {name: '치즈볼', price: '5,000원'}, {name: '감자튀김', price: '4,000원'}] }
];

export const MOCK_USERS: User[] = [
  { id: 'u1', name: '김서연', initial: '서' },
  { id: 'u2', name: '이준호', initial: '준' },
  { id: 'u3', name: '박지민', initial: '민' },
  { id: 'u4', name: '최현우', initial: '현' },
  { id: 'u5', name: '정수아', initial: '수' },
  { id: 'u6', name: '한도윤', initial: '도' },
  { id: 'u7', name: '오지후', initial: '후' },
  { id: 'u8', name: '윤서윤', initial: '윤' },
];

export const CURRENT_USER: User = { id: 'me', name: '나', initial: '나' };

export function createInitialPots(): Pot[] {
  const now = new Date();
  return [
    {
      id: 'p1',
      restaurantId: 'bbq',
      deadline: new Date(now.getTime() + 7 * 60000),
      participants: [MOCK_USERS[0], MOCK_USERS[1], MOCK_USERS[2]],
      status: 'active'
    },
    {
      id: 'p2',
      restaurantId: 'starbucks',
      deadline: new Date(now.getTime() + 18 * 60000),
      participants: [MOCK_USERS[3], MOCK_USERS[4]],
      status: 'active'
    },
    {
      id: 'p3',
      restaurantId: 'dominos',
      deadline: new Date(now.getTime() + 2 * 60000),
      participants: [MOCK_USERS[5], MOCK_USERS[6], MOCK_USERS[7], MOCK_USERS[0], MOCK_USERS[1]],
      status: 'active'
    },
    {
      id: 'p4',
      restaurantId: 'mega',
      deadline: new Date(now.getTime() + 25 * 60000),
      participants: [MOCK_USERS[2]],
      status: 'active'
    },
    {
      id: 'p5',
      restaurantId: 'tteok',
      deadline: new Date(now.getTime() + 12 * 60000),
      participants: [MOCK_USERS[3], MOCK_USERS[4], MOCK_USERS[5], MOCK_USERS[6]],
      status: 'active'
    }
  ];
}
