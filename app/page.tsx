"use client";

import { FormEvent, useMemo, useState } from "react";

type OrderPeriod = "lunch" | "cafe";

type Restaurant = {
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
  representativeMenu: string;
  representativeMenuPrice: number;
};

type Recruitment = {
  id: string;
  restaurantId: string;
  period: OrderPeriod;
  deadline: string;
  participants: number;
};

const money = new Intl.NumberFormat("ko-KR");

const RESTAURANTS: Restaurant[] = [
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
    representativeMenu: "불향 짬뽕",
    representativeMenuPrice: 12000,
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
    representativeMenu: "닭가슴살 웜볼",
    representativeMenuPrice: 10500,
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
    representativeMenu: "등심 돈카츠",
    representativeMenuPrice: 12500,
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
    representativeMenu: "돼지 김치찌개",
    representativeMenuPrice: 12000,
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
    representativeMenu: "아메리카노",
    representativeMenuPrice: 4500,
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
    representativeMenu: "버터 소금빵",
    representativeMenuPrice: 3800,
  },
];

const INITIAL_RECRUITMENTS: Recruitment[] = [
  {
    id: "lunch-1",
    restaurantId: "greenbowl",
    period: "lunch",
    deadline: "12:15",
    participants: 3,
  },
  {
    id: "lunch-2",
    restaurantId: "jjambbong",
    period: "lunch",
    deadline: "12:30",
    participants: 6,
  },
  {
    id: "lunch-3",
    restaurantId: "tokyo-katsu",
    period: "lunch",
    deadline: "12:40",
    participants: 2,
  },
  {
    id: "cafe-1",
    restaurantId: "afternoon-coffee",
    period: "cafe",
    deadline: "14:20",
    participants: 5,
  },
  {
    id: "cafe-2",
    restaurantId: "studio-bakery",
    period: "cafe",
    deadline: "15:00",
    participants: 2,
  },
];

function restaurantsForPeriod(period: OrderPeriod) {
  return RESTAURANTS.filter((restaurant) =>
    period === "cafe"
      ? restaurant.category === "카페"
      : restaurant.category !== "카페",
  );
}

export default function Home() {
  const [period, setPeriod] = useState<OrderPeriod>("lunch");
  const [query, setQuery] = useState("");
  const [recruitments, setRecruitments] = useState(INITIAL_RECRUITMENTS);
  const [joined, setJoined] = useState<Record<string, boolean>>({});
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [draftRestaurantId, setDraftRestaurantId] = useState(
    restaurantsForPeriod("lunch")[0].id,
  );
  const [draftDeadline, setDraftDeadline] = useState("12:30");
  const [message, setMessage] = useState("");

  const visibleRecruitments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return recruitments
      .filter((recruitment) => recruitment.period === period)
      .filter((recruitment) => {
        const restaurant = RESTAURANTS.find(
          (item) => item.id === recruitment.restaurantId,
        );
        if (!restaurant || !normalizedQuery) return Boolean(restaurant);

        return [restaurant.name, restaurant.category, restaurant.address].some(
          (value) => value.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
  }, [period, query, recruitments]);

  const periodParticipantCount = recruitments
    .filter((recruitment) => recruitment.period === period)
    .reduce((sum, recruitment) => sum + recruitment.participants, 0);

  function changePeriod(nextPeriod: OrderPeriod) {
    setPeriod(nextPeriod);
    setQuery("");
    setShowCreateForm(false);
    setDraftRestaurantId(restaurantsForPeriod(nextPeriod)[0].id);
    setDraftDeadline(nextPeriod === "lunch" ? "12:30" : "14:30");
  }

  function toggleParticipation(recruitmentId: string) {
    const isJoined = joined[recruitmentId] ?? false;

    setRecruitments((current) =>
      current.map((recruitment) =>
        recruitment.id === recruitmentId
          ? {
              ...recruitment,
              participants: Math.max(
                1,
                recruitment.participants + (isJoined ? -1 : 1),
              ),
            }
          : recruitment,
      ),
    );
    setJoined((current) => ({ ...current, [recruitmentId]: !isJoined }));
    setMessage(isJoined ? "참여를 취소했어요." : "공동주문에 참여했어요.");
  }

  function createRecruitment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draftRestaurantId || !draftDeadline) return;

    const id = `recruitment-${Date.now()}`;
    setRecruitments((current) => [
      ...current,
      {
        id,
        restaurantId: draftRestaurantId,
        period,
        deadline: draftDeadline,
        participants: 1,
      },
    ]);
    setJoined((current) => ({ ...current, [id]: true }));
    setShowCreateForm(false);
    setMessage("새 모집을 만들고 첫 참여자로 등록했어요.");
  }

  return (
    <main className="app-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="모여밥 홈">
          <span className="brand-mark" aria-hidden="true">
            ㅁ
          </span>
          <span>
            모여밥
            <small>서울대 시흥캠퍼스</small>
          </span>
        </a>
        <button
          className="slack-login"
          type="button"
          onClick={() => setMessage("Slack 로그인은 다음 연동 단계에서 연결합니다.")}
        >
          <span aria-hidden="true">#</span>
          Slack으로 로그인
          <small>연동 예정</small>
        </button>
      </header>

      <section className="intro" id="top">
        <div className="intro-copy">
          <span className="eyebrow">실시간 공동주문 현황</span>
          <h1>
            같이 주문할 사람을
            <br />
            지금 찾아보세요.
          </h1>
          <p>
            모집 마감 시간을 확인하고 원하는 음식점에 참여하세요. 먹는 모임은
            기존 점심조와 함께해도, 같이 주문한 사람들과 새로 만들어도 됩니다.
          </p>
        </div>
        <div className="intro-summary" aria-label="현재 현황 요약">
          <div>
            <span>진행 중인 모집</span>
            <strong>
              {visibleRecruitments.length}<small>개</small>
            </strong>
          </div>
          <div>
            <span>현재 참여 인원</span>
            <strong>
              {periodParticipantCount}<small>명</small>
            </strong>
          </div>
          <p>
            <span className="live-dot" aria-hidden="true" />
            화면 확인용 예시 데이터
          </p>
        </div>
      </section>

      <section className="board" aria-labelledby="board-title">
        <div className="board-heading">
          <div>
            <span className="section-label">LIVE BOARD</span>
            <h2 id="board-title">마감이 가까운 모집</h2>
            <p>참여 가능한 공동주문을 마감 시간 순서로 보여드려요.</p>
          </div>
          <button
            className="create-button"
            type="button"
            aria-expanded={showCreateForm}
            onClick={() => setShowCreateForm((current) => !current)}
          >
            {showCreateForm ? "닫기" : "새 모집 만들기"}
            <span aria-hidden="true">{showCreateForm ? "×" : "+"}</span>
          </button>
        </div>

        <div className="board-tools">
          <div className="period-tabs" aria-label="주문 종류">
            <button
              className={period === "lunch" ? "active" : ""}
              type="button"
              onClick={() => changePeriod("lunch")}
            >
              점심
              <small>13:00~14:00</small>
            </button>
            <button
              className={period === "cafe" ? "active" : ""}
              type="button"
              onClick={() => changePeriod("cafe")}
            >
              카페
              <small>시간 자유</small>
            </button>
          </div>
          <label className="search-field">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="음식점 또는 카테고리 검색"
            />
          </label>
        </div>

        {showCreateForm && (
          <form className="create-form" onSubmit={createRecruitment}>
            <div className="form-copy">
              <span>NEW ORDER</span>
              <strong>공동주문 모집 만들기</strong>
              <p>모집을 만들면 첫 참여자로 자동 등록됩니다.</p>
            </div>
            <label>
              <span>음식점</span>
              <select
                value={draftRestaurantId}
                onChange={(event) => setDraftRestaurantId(event.target.value)}
              >
                {restaurantsForPeriod(period).map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>모집 마감 시간</span>
              <input
                type="time"
                value={draftDeadline}
                onChange={(event) => setDraftDeadline(event.target.value)}
                required
              />
            </label>
            <button type="submit">모집 시작하기</button>
          </form>
        )}

        <div className="recruitment-list">
          {visibleRecruitments.map((recruitment) => {
            const restaurant = RESTAURANTS.find(
              (item) => item.id === recruitment.restaurantId,
            );
            if (!restaurant) return null;

            const isJoined = joined[recruitment.id] ?? false;

            return (
              <article className="recruitment-card" key={recruitment.id}>
                <div className="card-main">
                  <div className="card-status">
                    <span>참여 가능</span>
                    <strong>{recruitment.deadline} 마감</strong>
                  </div>
                  <div className="restaurant-heading">
                    <span className="category-chip">{restaurant.category}</span>
                    <h3>{restaurant.name}</h3>
                    <span className="rating" aria-label={`평점 ${restaurant.rating}`}>
                      ★ {restaurant.rating}
                    </span>
                  </div>
                  <p className="address">{restaurant.address}</p>

                  <div className="restaurant-facts">
                    <div>
                      <span>예측 배달</span>
                      <strong>{restaurant.estimatedDelivery}</strong>
                    </div>
                    <div>
                      <span>최소 주문</span>
                      <strong>{money.format(restaurant.minimumOrder)}원</strong>
                    </div>
                    <div>
                      <span>대표 메뉴</span>
                      <strong>
                        {restaurant.representativeMenu} ·{" "}
                        {money.format(restaurant.representativeMenuPrice)}원
                      </strong>
                    </div>
                  </div>

                  <details className="store-details">
                    <summary>매장 정보 더보기</summary>
                    <dl>
                      <div>
                        <dt>운영시간</dt>
                        <dd>{restaurant.businessHours}</dd>
                      </div>
                      <div>
                        <dt>휴무일</dt>
                        <dd>{restaurant.closedDays}</dd>
                      </div>
                      <div>
                        <dt>전화번호</dt>
                        <dd>{restaurant.phone}</dd>
                      </div>
                    </dl>
                  </details>
                </div>

                <div className="participation-panel">
                  <span>현재 참여</span>
                  <strong>
                    {recruitment.participants}<small>명</small>
                  </strong>
                  <p>참여자 정보는 참여한 사람끼리만 확인해요.</p>
                  <button
                    className={isJoined ? "joined" : ""}
                    type="button"
                    onClick={() => toggleParticipation(recruitment.id)}
                  >
                    {isJoined ? "참여 취소" : "참여하기"}
                  </button>
                </div>
              </article>
            );
          })}

          {visibleRecruitments.length === 0 && (
            <div className="empty-state">
              <strong>조건에 맞는 모집이 없어요.</strong>
              <p>검색어를 바꾸거나 새로운 공동주문 모집을 만들어 보세요.</p>
            </div>
          )}
        </div>
      </section>

      <section className="simple-guide" aria-labelledby="guide-title">
        <span className="section-label">HOW TO USE</span>
        <h2 id="guide-title">모여밥은 이렇게 사용해요</h2>
        <div>
          <article>
            <span>01</span>
            <strong>현황 확인</strong>
            <p>마감이 가까운 공동주문과 현재 참여 인원을 확인해요.</p>
          </article>
          <article>
            <span>02</span>
            <strong>참여 또는 모집</strong>
            <p>원하는 모집에 참여하거나 음식점과 마감 시간을 등록해요.</p>
          </article>
          <article>
            <span>03</span>
            <strong>Slack에서 대화</strong>
            <p>참여자끼리 주문 담당자와 실제 주문 내용을 정해요.</p>
          </article>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true">
            ㅁ
          </span>
          <span>모여밥</span>
        </div>
        <p>시흥캠퍼스의 공동주문을 더 쉽게.</p>
        <span>1차 구조 프로토타입 · 화면의 매장과 수치는 예시입니다</span>
      </footer>

      {message && (
        <button
          className="toast"
          type="button"
          onClick={() => setMessage("")}
          aria-live="polite"
        >
          {message}
          <span aria-hidden="true">×</span>
        </button>
      )}
    </main>
  );
}
