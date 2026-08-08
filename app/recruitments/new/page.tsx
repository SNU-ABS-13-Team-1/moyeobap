"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  OrderPeriod,
  getRestaurant,
  restaurantsForPeriod,
} from "@/app/lib/prototype-data";
import { usePrototype } from "@/app/prototype-context";

export default function NewRecruitmentPage() {
  const router = useRouter();
  const {
    currentUser,
    recruitments,
    login,
    createRecruitment,
    requestRestaurant,
  } = usePrototype();
  const [period, setPeriod] = useState<OrderPeriod>("lunch");
  const [query, setQuery] = useState("");
  const [restaurantId, setRestaurantId] = useState(
    restaurantsForPeriod("lunch")[0].id,
  );
  const [deadline, setDeadline] = useState("12:30");

  const availableRestaurants = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return restaurantsForPeriod(period).filter((restaurant) =>
      normalized
        ? [restaurant.name, restaurant.category].some((value) =>
            value.toLowerCase().includes(normalized),
          )
        : true,
    );
  }, [period, query]);

  const selectedRestaurant = getRestaurant(restaurantId);
  const matchingRecruitments = recruitments
    .filter(
      (recruitment) =>
        recruitment.restaurantId === restaurantId &&
        recruitment.status === "open",
    )
    .sort((a, b) => a.deadline.localeCompare(b.deadline));
  const duplicate = matchingRecruitments.find(
    (recruitment) => recruitment.deadline === deadline,
  );

  function changePeriod(nextPeriod: OrderPeriod) {
    setPeriod(nextPeriod);
    setQuery("");
    setRestaurantId(restaurantsForPeriod(nextPeriod)[0].id);
    setDeadline(nextPeriod === "lunch" ? "12:30" : "14:30");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currentUser) {
      login();
      return;
    }

    const result = createRecruitment({ restaurantId, period, deadline });
    if (result.ok) {
      router.push(`/recruitments/${result.recruitmentId}`);
    } else {
      router.push(`/recruitments/${result.duplicateId}`);
    }
  }

  return (
    <main className="page-shell create-shell">
      <Link className="back-link" href="/">
        ← 실시간 현황판
      </Link>

      <form className="create-page" onSubmit={handleSubmit}>
        <header className="create-page-heading">
          <span className="section-label">NEW RECRUITMENT</span>
          <h1>새 모집 만들기</h1>
          <p>음식점과 모집 마감 시간만 정하면 바로 시작할 수 있어요.</p>
        </header>

        {!currentUser && (
          <section className="auth-gate">
            <div>
              <strong>모집을 만들려면 Slack 인증이 필요해요.</strong>
              <p>현황 확인은 로그인 없이 가능하고 생성할 때만 인증합니다.</p>
            </div>
            <button type="button" onClick={login}>
              Slack으로 로그인
            </button>
          </section>
        )}

        <section className="create-step" aria-labelledby="restaurant-step-title">
          <div className="step-heading">
            <span>1</span>
            <div>
              <h2 id="restaurant-step-title">음식점 선택</h2>
              <p>검토된 매장 중 함께 주문할 곳을 골라주세요.</p>
            </div>
          </div>

          <div className="period-tabs create-period-tabs" aria-label="주문 종류">
            <button
              className={period === "lunch" ? "active" : ""}
              type="button"
              aria-pressed={period === "lunch"}
              onClick={() => changePeriod("lunch")}
            >
              점심
            </button>
            <button
              className={period === "cafe" ? "active" : ""}
              type="button"
              aria-pressed={period === "cafe"}
              onClick={() => changePeriod("cafe")}
            >
              카페
            </button>
          </div>

          <label className="search-field restaurant-search">
            <span className="sr-only">음식점 또는 카테고리 검색</span>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="음식점 또는 카테고리 검색"
            />
          </label>

          <div className="restaurant-picker">
            {availableRestaurants.map((restaurant) => (
              <label
                className={restaurantId === restaurant.id ? "selected" : ""}
                key={restaurant.id}
              >
                <input
                  type="radio"
                  name="restaurant"
                  value={restaurant.id}
                  checked={restaurantId === restaurant.id}
                  onChange={() => setRestaurantId(restaurant.id)}
                />
                <span className="category-chip">{restaurant.category}</span>
                <strong>{restaurant.name}</strong>
                <small>
                  대표 메뉴 {restaurant.representativeMenus.length}개 · 예상 배달{" "}
                  {restaurant.estimatedDelivery}
                </small>
              </label>
            ))}
          </div>

          {availableRestaurants.length === 0 && (
            <div className="request-restaurant">
              <strong>찾는 음식점이 없어요.</strong>
              <button type="button" onClick={requestRestaurant}>
                매장 추가 요청
              </button>
            </div>
          )}
        </section>

        {matchingRecruitments.length > 0 && (
          <section className="existing-recruitments" aria-labelledby="existing-title">
            <div>
              <span className="section-label">CHECK FIRST</span>
              <h2 id="existing-title">같은 음식점의 진행 중 모집</h2>
            </div>
            <div>
              {matchingRecruitments.map((recruitment) => (
                <Link key={recruitment.id} href={`/recruitments/${recruitment.id}`}>
                  <span>{recruitment.deadline} 마감</span>
                  <strong>{recruitment.participants.length}명 참여 중</strong>
                  <em>기존 모집 보기 →</em>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="create-step" aria-labelledby="deadline-step-title">
          <div className="step-heading">
            <span>2</span>
            <div>
              <h2 id="deadline-step-title">모집 마감 시간</h2>
              <p>이 시간이 지나면 새 참여와 참여 취소가 모두 마감됩니다.</p>
            </div>
          </div>

          <label className="deadline-field">
            <span>모집 마감</span>
            <input
              type="time"
              value={deadline}
              onChange={(event) => setDeadline(event.target.value)}
              required
            />
          </label>
        </section>

        <section className="creation-summary">
          <div>
            <span>선택 내용</span>
            <strong>{selectedRestaurant?.name}</strong>
            <p>
              {period === "lunch" ? "점심" : "카페"} · {deadline} 모집 마감
            </p>
          </div>
          {duplicate ? (
            <Link href={`/recruitments/${duplicate.id}`}>
              같은 마감의 기존 모집 보기
            </Link>
          ) : (
            <button
              type={currentUser ? "submit" : "button"}
              onClick={currentUser ? undefined : login}
            >
              {currentUser ? "모집 시작하기" : "Slack 로그인 후 계속"}
            </button>
          )}
        </section>
      </form>
    </main>
  );
}
