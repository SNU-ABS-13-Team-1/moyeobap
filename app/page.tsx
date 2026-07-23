"use client";

import { useMemo, useState } from "react";

type OrderPeriod = "lunch" | "cafe";
type Category = "전체" | "한식" | "중식" | "일식" | "샐러드" | "카페";

type Menu = {
  id: string;
  name: string;
  description: string;
  price: number;
  demand: number;
  tag?: string;
};

type Restaurant = {
  id: string;
  name: string;
  category: Exclude<Category, "전체">;
  period: OrderPeriod;
  icon: string;
  color: string;
  pale: string;
  demand: number;
  amount: number;
  minOrder: number;
  deliveryFee: number;
  eta: string;
  confirmed?: boolean;
  hasOrderer: boolean;
  menus: Menu[];
};

type ConfirmedChoice = {
  restaurantId: string;
  menuId: string;
  quantity: number;
};

const money = new Intl.NumberFormat("ko-KR");

const INITIAL_RESTAURANTS: Restaurant[] = [
  {
    id: "jjambbong",
    name: "배곧 짬뽕관",
    category: "중식",
    period: "lunch",
    icon: "面",
    color: "#e95f2b",
    pale: "#fff1e8",
    demand: 6,
    amount: 73500,
    minOrder: 15000,
    deliveryFee: 4000,
    eta: "11:50 도착 예상",
    hasOrderer: true,
    menus: [
      {
        id: "spicy-jjambbong",
        name: "불향 짬뽕",
        description: "해산물과 채소를 센 불에 볶아낸 대표 메뉴",
        price: 12000,
        demand: 3,
        tag: "인기",
      },
      {
        id: "jjajang",
        name: "옛날 짜장면",
        description: "춘장과 양파의 단맛이 살아있는 기본 짜장",
        price: 9000,
        demand: 2,
      },
      {
        id: "soft-tofu",
        name: "순두부 짬뽕밥",
        description: "얼큰한 국물에 순두부와 공기밥",
        price: 13000,
        demand: 1,
      },
      {
        id: "fried-rice",
        name: "새우 볶음밥",
        description: "고슬고슬하게 볶아낸 담백한 한 끼",
        price: 10000,
        demand: 0,
      },
    ],
  },
  {
    id: "greenbowl",
    name: "그린보울 샐러드",
    category: "샐러드",
    period: "lunch",
    icon: "葉",
    color: "#3f845b",
    pale: "#eaf6ed",
    demand: 3,
    amount: 27500,
    minOrder: 30000,
    deliveryFee: 3000,
    eta: "12:05 도착 예상",
    hasOrderer: true,
    menus: [
      {
        id: "chicken-bowl",
        name: "닭가슴살 웜볼",
        description: "구운 채소와 현미, 허브 닭가슴살",
        price: 10500,
        demand: 2,
        tag: "가벼운 한 끼",
      },
      {
        id: "salmon-salad",
        name: "훈제연어 샐러드",
        description: "훈제연어와 아보카도, 레몬 드레싱",
        price: 12500,
        demand: 1,
      },
      {
        id: "tofu-bowl",
        name: "두부 버섯볼",
        description: "구운 두부와 버섯을 곁들인 비건 메뉴",
        price: 9500,
        demand: 0,
      },
    ],
  },
  {
    id: "tokyo-katsu",
    name: "도쿄카츠 배곧점",
    category: "일식",
    period: "lunch",
    icon: "豚",
    color: "#b37b21",
    pale: "#fff7df",
    demand: 2,
    amount: 25000,
    minOrder: 20000,
    deliveryFee: 4500,
    eta: "12:10 도착 예상",
    hasOrderer: false,
    menus: [
      {
        id: "sirloin",
        name: "등심 돈카츠",
        description: "두툼한 국내산 등심과 수제 소스",
        price: 12500,
        demand: 2,
        tag: "대표",
      },
      {
        id: "cheese",
        name: "치즈 돈카츠",
        description: "모차렐라 치즈를 채운 부드러운 돈카츠",
        price: 14500,
        demand: 0,
      },
      {
        id: "curry",
        name: "카츠 카레",
        description: "숙성 카레와 바삭한 미니 등심카츠",
        price: 13000,
        demand: 0,
      },
    ],
  },
  {
    id: "stew",
    name: "오늘의 김치찌개",
    category: "한식",
    period: "lunch",
    icon: "湯",
    color: "#ca3c3c",
    pale: "#fff0ee",
    demand: 1,
    amount: 12000,
    minOrder: 18000,
    deliveryFee: 3000,
    eta: "11:55 도착 예상",
    hasOrderer: true,
    menus: [
      {
        id: "pork-stew",
        name: "돼지 김치찌개",
        description: "묵은지와 돼지고기를 푹 끓인 1인 찌개",
        price: 12000,
        demand: 1,
      },
      {
        id: "tuna-stew",
        name: "참치 김치찌개",
        description: "참치와 두부가 넉넉하게 들어간 찌개",
        price: 11000,
        demand: 0,
      },
      {
        id: "bulgogi",
        name: "제육볶음 정식",
        description: "매콤한 제육볶음과 계란말이 반찬",
        price: 13000,
        demand: 0,
      },
    ],
  },
  {
    id: "afternoon-coffee",
    name: "오후커피 로스터스",
    category: "카페",
    period: "cafe",
    icon: "豆",
    color: "#755037",
    pale: "#f5eee8",
    demand: 5,
    amount: 28000,
    minOrder: 15000,
    deliveryFee: 2500,
    eta: "14:45 도착 예상",
    confirmed: true,
    hasOrderer: true,
    menus: [
      {
        id: "americano",
        name: "아메리카노",
        description: "고소한 견과류 향의 하우스 블렌드",
        price: 4500,
        demand: 3,
        tag: "인기",
      },
      {
        id: "latte",
        name: "카페라떼",
        description: "진한 에스프레소와 부드러운 우유",
        price: 5200,
        demand: 2,
      },
      {
        id: "lemon-ade",
        name: "수제 레몬에이드",
        description: "생레몬청으로 만든 상큼한 에이드",
        price: 5800,
        demand: 0,
      },
    ],
  },
  {
    id: "studio-bakery",
    name: "스튜디오 베이커리",
    category: "카페",
    period: "cafe",
    icon: "麦",
    color: "#9b653f",
    pale: "#fff3e7",
    demand: 2,
    amount: 13400,
    minOrder: 20000,
    deliveryFee: 3500,
    eta: "15:00 도착 예상",
    hasOrderer: true,
    menus: [
      {
        id: "salt-bread",
        name: "버터 소금빵",
        description: "겉은 바삭하고 속은 촉촉한 시그니처",
        price: 3800,
        demand: 2,
        tag: "오늘 갓 구움",
      },
      {
        id: "sandwich",
        name: "바질 치킨 샌드위치",
        description: "닭가슴살과 바질페스토, 루콜라",
        price: 7600,
        demand: 0,
      },
      {
        id: "vanilla-latte",
        name: "바닐라빈 라떼",
        description: "직접 만든 바닐라빈 시럽과 우유",
        price: 5700,
        demand: 0,
      },
    ],
  },
];

function getStatus(restaurant: Restaurant) {
  if (restaurant.confirmed) {
    return {
      label: "주문 확정",
      detail: "메뉴 변경 마감",
      className: "confirmed",
    };
  }
  if (restaurant.amount >= restaurant.minOrder && restaurant.hasOrderer) {
    return {
      label: "주문 가능",
      detail: "지금 선택하면 함께 주문돼요",
      className: "ready",
    };
  }
  if (restaurant.amount >= restaurant.minOrder && !restaurant.hasOrderer) {
    return {
      label: "담당자 필요",
      detail: "주문 담당 가능자가 필요해요",
      className: "orderer",
    };
  }
  const remaining = restaurant.minOrder - restaurant.amount;
  if (remaining <= 5000) {
    return {
      label: "성립 임박",
      detail: `${money.format(remaining)}원만 더 모이면 돼요`,
      className: "almost",
    };
  }
  return {
    label: "매칭 대기",
    detail: `${money.format(remaining)}원 더 필요해요`,
    className: "waiting",
  };
}

export default function Home() {
  const [period, setPeriod] = useState<OrderPeriod>("lunch");
  const [category, setCategory] = useState<Category>("전체");
  const [query, setQuery] = useState("");
  const [restaurants, setRestaurants] = useState(INITIAL_RESTAURANTS);
  const [selectedRestaurantId, setSelectedRestaurantId] =
    useState("jjambbong");
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(
    "spicy-jjambbong",
  );
  const [quantity, setQuantity] = useState(1);
  const [confirmedChoice, setConfirmedChoice] =
    useState<ConfirmedChoice | null>(null);
  const [toast, setToast] = useState("");
  const [chatOpen, setChatOpen] = useState(false);

  const visibleRestaurants = useMemo(() => {
    return restaurants
      .filter((restaurant) => restaurant.period === period)
      .filter(
        (restaurant) =>
          category === "전체" || restaurant.category === category,
      )
      .filter((restaurant) =>
        restaurant.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
      .sort((a, b) => {
        const aReady = a.amount >= a.minOrder ? 1 : 0;
        const bReady = b.amount >= b.minOrder ? 1 : 0;
        return bReady - aReady || b.demand - a.demand;
      });
  }, [restaurants, period, category, query]);

  const selectedRestaurant =
    restaurants.find(
      (restaurant) => restaurant.id === selectedRestaurantId,
    ) ?? visibleRestaurants[0];

  const selectedMenu = selectedRestaurant?.menus.find(
    (menu) => menu.id === selectedMenuId,
  );

  const periodRestaurants = restaurants.filter(
    (restaurant) => restaurant.period === period,
  );
  const totalDemand = periodRestaurants.reduce(
    (sum, restaurant) => sum + restaurant.demand,
    0,
  );
  const readyCount = periodRestaurants.filter(
    (restaurant) =>
      restaurant.confirmed ||
      (restaurant.amount >= restaurant.minOrder && restaurant.hasOrderer),
  ).length;

  const categories: Category[] =
    period === "lunch"
      ? ["전체", "한식", "중식", "일식", "샐러드"]
      : ["전체", "카페"];

  function selectRestaurant(id: string) {
    const next = restaurants.find((restaurant) => restaurant.id === id);
    if (!next) return;
    setSelectedRestaurantId(id);
    setSelectedMenuId(next.menus[0]?.id ?? null);
    setQuantity(1);
    document
      .getElementById("menu-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changePeriod(nextPeriod: OrderPeriod) {
    setPeriod(nextPeriod);
    setCategory("전체");
    const first = restaurants.find(
      (restaurant) => restaurant.period === nextPeriod,
    );
    if (first) {
      setSelectedRestaurantId(first.id);
      setSelectedMenuId(first.menus[0]?.id ?? null);
      setQuantity(1);
    }
  }

  function confirmSelection() {
    if (!selectedRestaurant || !selectedMenu) return;

    setRestaurants((current) =>
      current.map((restaurant) => {
        let nextRestaurant = restaurant;

        if (confirmedChoice?.restaurantId === restaurant.id) {
          const previousMenu = restaurant.menus.find(
            (menu) => menu.id === confirmedChoice.menuId,
          );
          const previousPrice = previousMenu?.price ?? 0;
          nextRestaurant = {
            ...nextRestaurant,
            demand: Math.max(0, nextRestaurant.demand - 1),
            amount: Math.max(
              0,
              nextRestaurant.amount -
                previousPrice * confirmedChoice.quantity,
            ),
            menus: nextRestaurant.menus.map((menu) =>
              menu.id === confirmedChoice.menuId
                ? {
                    ...menu,
                    demand: Math.max(0, menu.demand - 1),
                  }
                : menu,
            ),
          };
        }

        if (selectedRestaurant.id === restaurant.id) {
          nextRestaurant = {
            ...nextRestaurant,
            demand: nextRestaurant.demand + 1,
            amount: nextRestaurant.amount + selectedMenu.price * quantity,
            menus: nextRestaurant.menus.map((menu) =>
              menu.id === selectedMenu.id
                ? { ...menu, demand: menu.demand + 1 }
                : menu,
            ),
          };
        }

        return nextRestaurant;
      }),
    );

    setConfirmedChoice({
      restaurantId: selectedRestaurant.id,
      menuId: selectedMenu.id,
      quantity,
    });
    setToast("익명으로 수요에 반영했어요");
    window.setTimeout(() => setToast(""), 2600);
  }

  const confirmedRestaurant = confirmedChoice
    ? restaurants.find(
        (restaurant) => restaurant.id === confirmedChoice.restaurantId,
      )
    : null;
  const confirmedMenu = confirmedRestaurant?.menus.find(
    (menu) => menu.id === confirmedChoice?.menuId,
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="모여밥 홈">
          <span className="brand-mark">ㅁ</span>
          <span>
            모여밥
            <small>서울대 시흥캠퍼스</small>
          </span>
        </a>
        <nav className="top-nav" aria-label="주요 메뉴">
          <a className="active" href="#board">
            수요 상황판
          </a>
          <a href="#restaurants">음식점</a>
          <button
            className="profile-button"
            aria-label="내 프로필"
            type="button"
          >
            익명 17
          </button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            실시간 익명 수요
          </div>
          <h1>
            오늘, 뭐가
            <br />
            <em>당기세요?</em>
          </h1>
          <p>
            먹고 싶은 메뉴를 고르면 끝. 같은 음식점을 선택한 사람끼리
            자동으로 함께 주문해요.
          </p>
        </div>

        <div className="hero-status" id="board">
          <div className="period-switch" aria-label="주문 시간대 선택">
            <button
              className={period === "lunch" ? "active" : ""}
              onClick={() => changePeriod("lunch")}
              type="button"
            >
              점심
              <small>11:10 주문</small>
            </button>
            <button
              className={period === "cafe" ? "active" : ""}
              onClick={() => changePeriod("cafe")}
              type="button"
            >
              카페
              <small>14:10 주문</small>
            </button>
          </div>

          <div className="countdown">
            <span>선택 마감까지</span>
            <strong>{period === "lunch" ? "00:42:18" : "03:42:18"}</strong>
          </div>

          <div className="summary-grid">
            <div>
              <span>지금 선택한 사람</span>
              <strong>
                {totalDemand}
                <small>명</small>
              </strong>
            </div>
            <div>
              <span>주문 가능한 곳</span>
              <strong>
                {readyCount}
                <small>곳</small>
              </strong>
            </div>
            <div>
              <span>캠퍼스 참여율</span>
              <strong>
                {Math.min(100, Math.round((totalDemand / 40) * 100))}
                <small>%</small>
              </strong>
            </div>
          </div>
          <div className="privacy-note">
            <span aria-hidden="true">⌁</span>
            선택한 사람의 이름은 공개되지 않아요
          </div>
        </div>
      </section>

      <section className="workspace" id="restaurants">
        <div className="restaurant-column">
          <div className="section-heading">
            <div>
              <span className="section-kicker">LIVE BOARD</span>
              <h2>{period === "lunch" ? "점심" : "오후"} 수요 상황판</h2>
            </div>
            <span className="refresh-label">
              <span className="live-dot" />
              방금 갱신
            </span>
          </div>

          <label className="search-box">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              placeholder="음식점 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <div className="filter-row" aria-label="음식 종류">
            {categories.map((item) => (
              <button
                className={category === item ? "active" : ""}
                key={item}
                onClick={() => setCategory(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="restaurant-list">
            {visibleRestaurants.map((restaurant) => {
              const status = getStatus(restaurant);
              const progress = Math.min(
                100,
                Math.round((restaurant.amount / restaurant.minOrder) * 100),
              );
              const isSelected = selectedRestaurantId === restaurant.id;

              return (
                <button
                  className={`restaurant-card ${isSelected ? "selected" : ""}`}
                  key={restaurant.id}
                  onClick={() => selectRestaurant(restaurant.id)}
                  type="button"
                  aria-pressed={isSelected}
                >
                  <span
                    className="restaurant-icon"
                    style={{
                      color: restaurant.color,
                      background: restaurant.pale,
                    }}
                    aria-hidden="true"
                  >
                    {restaurant.icon}
                  </span>
                  <span className="restaurant-main">
                    <span className="restaurant-title-row">
                      <span>
                        <small>{restaurant.category}</small>
                        <strong>{restaurant.name}</strong>
                      </span>
                      <span className={`status-pill ${status.className}`}>
                        {status.label}
                      </span>
                    </span>
                    <span className="demand-line">
                      <strong>{restaurant.demand}명</strong>이 먹고 싶어 해요
                      <i>·</i>
                      {restaurant.eta}
                    </span>
                    <span className="progress-track">
                      <span
                        style={{
                          width: `${progress}%`,
                          background: restaurant.color,
                        }}
                      />
                    </span>
                    <span className="progress-caption">
                      <span>{status.detail}</span>
                      <strong>
                        {money.format(restaurant.amount)}원
                        <small>
                          {" "}
                          / {money.format(restaurant.minOrder)}원
                        </small>
                      </strong>
                    </span>
                  </span>
                  <span className="card-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              );
            })}
          </div>

          {visibleRestaurants.length === 0 && (
            <div className="empty-state">
              <strong>검색 결과가 없어요</strong>
              <span>다른 음식점 이름을 입력해보세요.</span>
            </div>
          )}
        </div>

        {selectedRestaurant && (
          <aside className="menu-panel" id="menu-panel">
            <div
              className="menu-identity"
              style={{ background: selectedRestaurant.pale }}
            >
              <div
                className="menu-identity-mark"
                style={{ color: selectedRestaurant.color }}
              >
                {selectedRestaurant.icon}
              </div>
              <div>
                <span>{selectedRestaurant.category}</span>
                <h2>{selectedRestaurant.name}</h2>
                <p>
                  배달비 {money.format(selectedRestaurant.deliveryFee)}원 ·{" "}
                  {selectedRestaurant.eta}
                </p>
              </div>
              <button
                className="chat-button"
                onClick={() => setChatOpen(true)}
                type="button"
              >
                대화
                <span>3</span>
              </button>
            </div>

            <div className="menu-header">
              <div>
                <span className="section-kicker">CHOOSE YOUR MENU</span>
                <h3>메뉴를 골라주세요</h3>
              </div>
              <span>메뉴 선택도 익명이에요</span>
            </div>

            <div className="menu-list">
              {selectedRestaurant.menus.map((menu) => {
                const checked = selectedMenuId === menu.id;
                return (
                  <label
                    className={`menu-item ${checked ? "checked" : ""}`}
                    key={menu.id}
                  >
                    <input
                      type="radio"
                      name="menu"
                      checked={checked}
                      onChange={() => {
                        setSelectedMenuId(menu.id);
                        setQuantity(1);
                      }}
                    />
                    <span className="radio-ui" aria-hidden="true" />
                    <span className="menu-copy">
                      <span className="menu-name-row">
                        <strong>{menu.name}</strong>
                        {menu.tag && <em>{menu.tag}</em>}
                      </span>
                      <small>{menu.description}</small>
                      <span className="menu-meta">
                        <b>{money.format(menu.price)}원</b>
                        {menu.demand >= 3 ? (
                          <i>{menu.demand}명 선택</i>
                        ) : menu.demand > 0 ? (
                          <i>선택 있음</i>
                        ) : null}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            {selectedMenu && (
              <div className="selection-footer">
                <div className="quantity-picker" aria-label="수량">
                  <button
                    onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                    type="button"
                    aria-label="수량 줄이기"
                  >
                    −
                  </button>
                  <strong>{quantity}</strong>
                  <button
                    onClick={() => setQuantity((value) => Math.min(5, value + 1))}
                    type="button"
                    aria-label="수량 늘리기"
                  >
                    +
                  </button>
                </div>
                <button
                  className="confirm-button"
                  onClick={confirmSelection}
                  type="button"
                >
                  <span>
                    {confirmedChoice ? "선택 변경하기" : "이 메뉴로 선택하기"}
                    <small>
                      선택 마감 전까지 언제든 바꿀 수 있어요
                    </small>
                  </span>
                  <strong>
                    {money.format(selectedMenu.price * quantity)}원
                    <span aria-hidden="true">→</span>
                  </strong>
                </button>
              </div>
            )}
          </aside>
        )}
      </section>

      <section className="how-it-works">
        <span className="section-kicker">HOW IT WORKS</span>
        <h2>방을 만들 필요 없이, 선택만 하세요</h2>
        <div className="steps">
          <article>
            <span>01</span>
            <strong>상황을 살펴보고</strong>
            <p>음식점별 익명 수요와 주문 성립 상태를 확인해요.</p>
          </article>
          <article>
            <span>02</span>
            <strong>메뉴를 선택하면</strong>
            <p>같은 음식점 수요에 자동으로 합산돼요.</p>
          </article>
          <article>
            <span>03</span>
            <strong>조건이 갖춰질 때</strong>
            <p>주문 담당자가 정해지고 공동주문이 확정돼요.</p>
          </article>
        </div>
      </section>

      <footer className="site-footer">
        <div className="brand footer-brand">
          <span className="brand-mark">ㅁ</span>
          <span>모여밥</span>
        </div>
        <p>시흥캠퍼스의 점심 선택을 조금 더 가볍게.</p>
        <span>프로토타입 · 화면의 음식점과 수치는 예시입니다</span>
      </footer>

      {confirmedChoice && confirmedRestaurant && confirmedMenu && (
        <div className="my-choice-bar" aria-live="polite">
          <span
            className="choice-icon"
            style={{
              color: confirmedRestaurant.color,
              background: confirmedRestaurant.pale,
            }}
          >
            {confirmedRestaurant.icon}
          </span>
          <span className="choice-copy">
            <small>나의 익명 선택</small>
            <strong>
              {confirmedRestaurant.name} · {confirmedMenu.name}
              {confirmedChoice.quantity > 1
                ? ` × ${confirmedChoice.quantity}`
                : ""}
            </strong>
          </span>
          <span className="choice-state">
            {getStatus(confirmedRestaurant).label}
          </span>
          <button
            onClick={() => {
              setSelectedRestaurantId(confirmedRestaurant.id);
              setSelectedMenuId(confirmedMenu.id);
              setQuantity(confirmedChoice.quantity);
              document
                .getElementById("menu-panel")
                ?.scrollIntoView({ behavior: "smooth" });
            }}
            type="button"
          >
            변경
          </button>
        </div>
      )}

      {chatOpen && selectedRestaurant && (
        <div
          className="chat-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setChatOpen(false);
          }}
        >
          <section
            className="chat-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedRestaurant.name} 공동주문 대화`}
          >
            <header>
              <div>
                <span>익명 공동주문 대화</span>
                <strong>{selectedRestaurant.name}</strong>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                type="button"
                aria-label="대화 닫기"
              >
                ×
              </button>
            </header>
            <div className="system-message">
              참여자의 임시 익명 닉네임만 표시돼요
            </div>
            <div className="messages">
              <div className="message">
                <span className="avatar avatar-green">잎</span>
                <p>
                  <strong>초록잎</strong>
                  저는 덜 맵게 요청할게요!
                  <small>10:03</small>
                </p>
              </div>
              <div className="message">
                <span className="avatar avatar-orange">귤</span>
                <p>
                  <strong>작은귤</strong>
                  최소 주문금액 넘었네요. 주문 담당 가능해요.
                  <small>10:06</small>
                </p>
              </div>
              <div className="message mine">
                <p>
                  <strong>나 · 익명 17</strong>
                  좋아요, 감사합니다!
                  <small>10:08</small>
                </p>
              </div>
            </div>
            <form
              className="chat-input"
              onSubmit={(event) => event.preventDefault()}
            >
              <input aria-label="메시지" placeholder="익명으로 메시지 보내기" />
              <button type="submit">보내기</button>
            </form>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </main>
  );
}
