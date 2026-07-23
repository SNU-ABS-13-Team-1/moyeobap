"use client";

import { useMemo, useState } from "react";

type OrderPeriod = "lunch" | "cafe";
type Category = "전체" | "한식" | "중식" | "일식" | "샐러드" | "카페";

type Menu = {
  id: string;
  name: string;
  price: number;
  visual: string;
  tone: string;
};

type Restaurant = {
  id: string;
  name: string;
  category: Exclude<Category, "전체">;
  period: OrderPeriod;
  visual: string;
  tone: string;
  demand: number;
  menus: Menu[];
};

type ConfirmedOrder = {
  restaurantId: string;
  items: Record<string, number>;
};

const money = new Intl.NumberFormat("ko-KR");

const INITIAL_RESTAURANTS: Restaurant[] = [
  {
    id: "jjambbong",
    name: "배곧 짬뽕관",
    category: "중식",
    period: "lunch",
    visual: "面",
    tone: "orange",
    demand: 6,
    menus: [
      {
        id: "spicy-jjambbong",
        name: "불향 짬뽕",
        price: 12000,
        visual: "🍜",
        tone: "orange",
      },
      {
        id: "jjajang",
        name: "옛날 짜장면",
        price: 9000,
        visual: "🥢",
        tone: "brown",
      },
      {
        id: "soft-tofu",
        name: "순두부 짬뽕밥",
        price: 13000,
        visual: "🍲",
        tone: "red",
      },
      {
        id: "fried-rice",
        name: "새우 볶음밥",
        price: 10000,
        visual: "🍚",
        tone: "gold",
      },
    ],
  },
  {
    id: "greenbowl",
    name: "그린보울 샐러드",
    category: "샐러드",
    period: "lunch",
    visual: "葉",
    tone: "green",
    demand: 3,
    menus: [
      {
        id: "chicken-bowl",
        name: "닭가슴살 웜볼",
        price: 10500,
        visual: "🥗",
        tone: "green",
      },
      {
        id: "salmon-salad",
        name: "훈제연어 샐러드",
        price: 12500,
        visual: "🥑",
        tone: "mint",
      },
      {
        id: "tofu-bowl",
        name: "두부 버섯볼",
        price: 9500,
        visual: "🥬",
        tone: "lime",
      },
    ],
  },
  {
    id: "tokyo-katsu",
    name: "도쿄카츠 배곧점",
    category: "일식",
    period: "lunch",
    visual: "豚",
    tone: "gold",
    demand: 2,
    menus: [
      {
        id: "sirloin",
        name: "등심 돈카츠",
        price: 12500,
        visual: "🍛",
        tone: "gold",
      },
      {
        id: "cheese",
        name: "치즈 돈카츠",
        price: 14500,
        visual: "🧀",
        tone: "yellow",
      },
      {
        id: "curry",
        name: "카츠 카레",
        price: 13000,
        visual: "🍛",
        tone: "brown",
      },
    ],
  },
  {
    id: "stew",
    name: "오늘의 김치찌개",
    category: "한식",
    period: "lunch",
    visual: "湯",
    tone: "red",
    demand: 1,
    menus: [
      {
        id: "pork-stew",
        name: "돼지 김치찌개",
        price: 12000,
        visual: "🍲",
        tone: "red",
      },
      {
        id: "tuna-stew",
        name: "참치 김치찌개",
        price: 11000,
        visual: "🥘",
        tone: "orange",
      },
      {
        id: "bulgogi",
        name: "제육볶음 정식",
        price: 13000,
        visual: "🍱",
        tone: "brown",
      },
    ],
  },
  {
    id: "afternoon-coffee",
    name: "오후커피 로스터스",
    category: "카페",
    period: "cafe",
    visual: "豆",
    tone: "coffee",
    demand: 5,
    menus: [
      {
        id: "americano",
        name: "아메리카노",
        price: 4500,
        visual: "☕",
        tone: "coffee",
      },
      {
        id: "latte",
        name: "카페라떼",
        price: 5200,
        visual: "🥛",
        tone: "cream",
      },
      {
        id: "lemon-ade",
        name: "수제 레몬에이드",
        price: 5800,
        visual: "🍋",
        tone: "yellow",
      },
    ],
  },
  {
    id: "studio-bakery",
    name: "스튜디오 베이커리",
    category: "카페",
    period: "cafe",
    visual: "麦",
    tone: "brown",
    demand: 2,
    menus: [
      {
        id: "salt-bread",
        name: "버터 소금빵",
        price: 3800,
        visual: "🥐",
        tone: "gold",
      },
      {
        id: "sandwich",
        name: "바질 치킨 샌드위치",
        price: 7600,
        visual: "🥪",
        tone: "green",
      },
      {
        id: "vanilla-latte",
        name: "바닐라빈 라떼",
        price: 5700,
        visual: "☕",
        tone: "cream",
      },
    ],
  },
];

export default function Home() {
  const [period, setPeriod] = useState<OrderPeriod>("lunch");
  const [category, setCategory] = useState<Category>("전체");
  const [query, setQuery] = useState("");
  const [restaurants, setRestaurants] = useState(INITIAL_RESTAURANTS);
  const [selectedRestaurantId, setSelectedRestaurantId] =
    useState("jjambbong");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [confirmedOrder, setConfirmedOrder] =
    useState<ConfirmedOrder | null>(null);
  const [toast, setToast] = useState("");

  const periodRestaurants = useMemo(
    () =>
      restaurants
        .filter((restaurant) => restaurant.period === period)
        .sort((a, b) => b.demand - a.demand || a.name.localeCompare(b.name)),
    [period, restaurants],
  );

  const visibleRestaurants = useMemo(
    () =>
      periodRestaurants
        .filter(
          (restaurant) =>
            category === "전체" || restaurant.category === category,
        )
        .filter((restaurant) =>
          restaurant.name.toLowerCase().includes(query.trim().toLowerCase()),
        ),
    [category, periodRestaurants, query],
  );

  const selectedRestaurant =
    restaurants.find(
      (restaurant) => restaurant.id === selectedRestaurantId,
    ) ?? periodRestaurants[0];

  const cartItems = selectedRestaurant
    ? selectedRestaurant.menus
        .filter((menu) => (cart[menu.id] ?? 0) > 0)
        .map((menu) => ({ ...menu, quantity: cart[menu.id] }))
    : [];

  const cartCount = cartItems.reduce(
    (sum, menu) => sum + menu.quantity,
    0,
  );
  const cartTotal = cartItems.reduce(
    (sum, menu) => sum + menu.price * menu.quantity,
    0,
  );
  const totalDemand = periodRestaurants.reduce(
    (sum, restaurant) => sum + restaurant.demand,
    0,
  );
  const activeRestaurants = periodRestaurants.filter(
    (restaurant) => restaurant.demand > 0,
  ).length;
  const categories: Category[] =
    period === "lunch"
      ? ["전체", "한식", "중식", "일식", "샐러드"]
      : ["전체", "카페"];

  const confirmedRestaurant = confirmedOrder
    ? restaurants.find(
        (restaurant) => restaurant.id === confirmedOrder.restaurantId,
      )
    : null;
  const confirmedCount =
    confirmedRestaurant && confirmedOrder
      ? confirmedRestaurant.menus.reduce(
          (sum, menu) => sum + (confirmedOrder.items[menu.id] ?? 0),
          0,
        )
      : 0;
  const confirmedTotal =
    confirmedRestaurant && confirmedOrder
      ? confirmedRestaurant.menus.reduce(
          (sum, menu) =>
            sum + menu.price * (confirmedOrder.items[menu.id] ?? 0),
          0,
        )
      : 0;

  function selectRestaurant(id: string) {
    setSelectedRestaurantId(id);
    if (confirmedOrder?.restaurantId === id) {
      setCart({ ...confirmedOrder.items });
    } else {
      setCart({});
    }
    document
      .getElementById("menu-panel")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function changePeriod(nextPeriod: OrderPeriod) {
    setPeriod(nextPeriod);
    setCategory("전체");
    setQuery("");
    const first = restaurants
      .filter((restaurant) => restaurant.period === nextPeriod)
      .sort((a, b) => b.demand - a.demand)[0];
    if (first) {
      setSelectedRestaurantId(first.id);
      setCart(
        confirmedOrder?.restaurantId === first.id
          ? { ...confirmedOrder.items }
          : {},
      );
    }
  }

  function updateQuantity(menuId: string, delta: number) {
    setCart((current) => {
      const nextQuantity = Math.max(
        0,
        Math.min(9, (current[menuId] ?? 0) + delta),
      );
      const next = { ...current };
      if (nextQuantity === 0) {
        delete next[menuId];
      } else {
        next[menuId] = nextQuantity;
      }
      return next;
    });
  }

  function confirmSelection() {
    if (!selectedRestaurant || cartCount === 0) return;

    setRestaurants((current) =>
      current.map((restaurant) => {
        if (
          confirmedOrder?.restaurantId === restaurant.id &&
          selectedRestaurant.id !== restaurant.id
        ) {
          return {
            ...restaurant,
            demand: Math.max(0, restaurant.demand - 1),
          };
        }
        if (
          selectedRestaurant.id === restaurant.id &&
          confirmedOrder?.restaurantId !== restaurant.id
        ) {
          return { ...restaurant, demand: restaurant.demand + 1 };
        }
        return restaurant;
      }),
    );

    setConfirmedOrder({
      restaurantId: selectedRestaurant.id,
      items: { ...cart },
    });
    setToast("내 선택이 익명 인원에 반영됐어요");
    window.setTimeout(() => setToast(""), 2600);
  }

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
          <span className="prototype-badge">공개 프로토타입</span>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            익명 수요 상황판
          </div>
          <h1>
            몇 명이
            <br />
            <em>골랐을까요?</em>
          </h1>
          <p>
            음식점별 현재 인원을 보고 직접 판단하세요. 먹고 싶은 메뉴를
            담으면 같은 선택에 익명으로 한 명이 더해져요.
          </p>
        </div>

        <div className="hero-board" id="board">
          <div className="period-switch" aria-label="주문 시간대 선택">
            <button
              className={period === "lunch" ? "active" : ""}
              onClick={() => changePeriod("lunch")}
              type="button"
            >
              점심
              <small>선택 마감 10:50</small>
            </button>
            <button
              className={period === "cafe" ? "active" : ""}
              onClick={() => changePeriod("cafe")}
              type="button"
            >
              카페
              <small>선택 마감 14:00</small>
            </button>
          </div>

          <div className="ranking-head">
            <span>지금 많이 고른 곳</span>
            <strong>{period === "lunch" ? "점심" : "오후 카페"}</strong>
          </div>

          <div className="demand-ranking">
            {periodRestaurants.slice(0, 3).map((restaurant, index) => (
              <button
                key={restaurant.id}
                onClick={() => selectRestaurant(restaurant.id)}
                type="button"
              >
                <span className="rank-number">{index + 1}</span>
                <span className={`rank-visual tone-${restaurant.tone}`}>
                  {restaurant.visual}
                </span>
                <span className="rank-name">{restaurant.name}</span>
                <strong>
                  {restaurant.demand}
                  <small>명</small>
                </strong>
              </button>
            ))}
          </div>

          <div className="summary-grid">
            <div>
              <span>현재 선택 인원</span>
              <strong>
                {totalDemand}
                <small>명</small>
              </strong>
            </div>
            <div>
              <span>선택 모인 곳</span>
              <strong>
                {activeRestaurants}
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
            이름과 개인 메뉴는 상황판에 공개되지 않아요
          </div>
        </div>
      </section>

      <section className="workspace" id="restaurants">
        <div className="restaurant-column">
          <div className="section-heading">
            <div>
              <span className="section-kicker">LIVE BOARD</span>
              <h2>{period === "lunch" ? "점심" : "카페"} 음식점</h2>
              <p>인원이 많은 순서로 보여드려요.</p>
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
            {visibleRestaurants.map((restaurant, index) => {
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
                    className={`restaurant-visual tone-${restaurant.tone}`}
                    aria-hidden="true"
                  >
                    <small>{index + 1}</small>
                    {restaurant.visual}
                  </span>
                  <span className="restaurant-copy">
                    <small>{restaurant.category}</small>
                    <strong>{restaurant.name}</strong>
                    <span>메뉴 보기</span>
                  </span>
                  <span className="demand-count">
                    <strong>{restaurant.demand}</strong>
                    <small>명 선택</small>
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
            <div className={`menu-identity tone-${selectedRestaurant.tone}`}>
              <span className="menu-identity-visual" aria-hidden="true">
                {selectedRestaurant.visual}
              </span>
              <div>
                <span>{selectedRestaurant.category}</span>
                <h2>{selectedRestaurant.name}</h2>
                <p>
                  현재 <strong>{selectedRestaurant.demand}명</strong>이
                  선택했어요
                </p>
              </div>
            </div>

            <div className="menu-header">
              <div>
                <span className="section-kicker">MENU</span>
                <h3>메뉴를 골라주세요</h3>
              </div>
              <span>이미지 · 이름 · 가격</span>
            </div>

            <div className="menu-grid">
              {selectedRestaurant.menus.map((menu) => {
                const quantity = cart[menu.id] ?? 0;
                return (
                  <article
                    className={`menu-card ${quantity > 0 ? "selected" : ""}`}
                    key={menu.id}
                  >
                    <div
                      className={`menu-image tone-${menu.tone}`}
                      role="img"
                      aria-label={`${menu.name} 예시 이미지 자리`}
                    >
                      <span>{menu.visual}</span>
                      <small>예시 이미지</small>
                    </div>
                    <div className="menu-card-body">
                      <strong>{menu.name}</strong>
                      <b>{money.format(menu.price)}원</b>
                      {quantity === 0 ? (
                        <button
                          className="add-button"
                          onClick={() => updateQuantity(menu.id, 1)}
                          type="button"
                        >
                          담기
                          <span>+</span>
                        </button>
                      ) : (
                        <div
                          className="quantity-picker"
                          aria-label={`${menu.name} 수량`}
                        >
                          <button
                            onClick={() => updateQuantity(menu.id, -1)}
                            type="button"
                            aria-label={`${menu.name} 수량 줄이기`}
                          >
                            −
                          </button>
                          <strong>{quantity}</strong>
                          <button
                            onClick={() => updateQuantity(menu.id, 1)}
                            type="button"
                            aria-label={`${menu.name} 수량 늘리기`}
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="cart-panel">
              <div className="cart-copy">
                <small>내 선택</small>
                {cartCount > 0 ? (
                  <>
                    <strong>{cartCount}개 메뉴</strong>
                    <span>{money.format(cartTotal)}원</span>
                  </>
                ) : (
                  <strong>메뉴를 담아주세요</strong>
                )}
              </div>
              <button
                className="confirm-button"
                onClick={confirmSelection}
                type="button"
                disabled={cartCount === 0}
              >
                익명 수요에 반영
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </aside>
        )}
      </section>

      <section className="how-it-works">
        <span className="section-kicker">HOW IT WORKS</span>
        <h2>판단은 가볍게, 선택은 익명으로</h2>
        <div className="steps">
          <article>
            <span>01</span>
            <strong>현재 인원을 보고</strong>
            <p>음식점별 몇 명이 선택했는지 한눈에 확인해요.</p>
          </article>
          <article>
            <span>02</span>
            <strong>메뉴를 담고</strong>
            <p>이미지, 이름과 가격을 보고 원하는 메뉴를 골라요.</p>
          </article>
          <article>
            <span>03</span>
            <strong>익명으로 반영해요</strong>
            <p>개인 메뉴는 숨기고 음식점 인원에 한 명을 더해요.</p>
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

      {confirmedOrder && confirmedRestaurant && (
        <div className="my-choice-bar" aria-live="polite">
          <span
            className={`choice-icon tone-${confirmedRestaurant.tone}`}
            aria-hidden="true"
          >
            {confirmedRestaurant.visual}
          </span>
          <span className="choice-copy">
            <small>나의 익명 선택</small>
            <strong>
              {confirmedRestaurant.name} · {confirmedCount}개
            </strong>
          </span>
          <span className="choice-total">
            {money.format(confirmedTotal)}원
          </span>
          <button
            onClick={() => {
              setSelectedRestaurantId(confirmedRestaurant.id);
              setCart({ ...confirmedOrder.items });
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

      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
        </div>
      )}
    </main>
  );
}
