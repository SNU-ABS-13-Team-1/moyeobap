"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { RecruitmentCard } from "@/app/components/recruitment-card";
import { OrderPeriod, getRestaurant } from "@/app/lib/prototype-data";
import { usePrototype } from "@/app/prototype-context";

type BoardView = "all" | "mine";

export default function Home() {
  const { currentUser, recruitments, login } = usePrototype();
  const [period, setPeriod] = useState<OrderPeriod>("lunch");
  const [view, setView] = useState<BoardView>("all");
  const [query, setQuery] = useState("");

  const visibleRecruitments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return recruitments
      .filter((recruitment) => recruitment.period === period)
      .filter((recruitment) => recruitment.status !== "cancelled")
      .filter((recruitment) => {
        if (view === "all") return recruitment.status === "open";
        if (!currentUser) return false;
        return recruitment.participants.some(
          (participant) => participant.id === currentUser.id,
        );
      })
      .filter((recruitment) => {
        const restaurant = getRestaurant(recruitment.restaurantId);
        if (!restaurant || !normalizedQuery) return Boolean(restaurant);
        return [restaurant.name, restaurant.category].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
  }, [currentUser, period, query, recruitments, view]);

  const openRecruitments = recruitments.filter(
    (recruitment) => recruitment.period === period && recruitment.status === "open",
  );
  const participantTotal = openRecruitments.reduce(
    (sum, recruitment) => sum + recruitment.participants.length,
    0,
  );

  function openMyRecruitments() {
    if (!currentUser) {
      login();
    }
    setView("mine");
  }

  return (
    <main className="app-shell">
      <section className="intro compact-intro" id="top">
        <div className="intro-copy">
          <span className="eyebrow">실시간 공동주문 현황</span>
          <h1>마감 전에 함께 주문해요.</h1>
          <p>
            음식점별 모집과 참여 인원을 확인하고, 원하는 공동주문에 빠르게
            참여하세요.
          </p>
        </div>
        <div className="intro-summary" aria-label="현재 현황 요약">
          <div>
            <span>진행 중인 모집</span>
            <strong>
              {openRecruitments.length}
              <small>개</small>
            </strong>
          </div>
          <div>
            <span>모집 참여 합계</span>
            <strong>
              {participantTotal}
              <small>명</small>
            </strong>
          </div>
          <p>
            <span className="live-dot" aria-hidden="true" />
            구조 확인용 예시 데이터
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
          <Link className="create-button" href="/recruitments/new">
            새 모집 만들기 <span aria-hidden="true">+</span>
          </Link>
        </div>

        <div className="board-view-tabs" aria-label="모집 보기">
          <button
            className={view === "all" ? "active" : ""}
            type="button"
            aria-pressed={view === "all"}
            onClick={() => setView("all")}
          >
            전체 모집
          </button>
          <button
            className={view === "mine" ? "active" : ""}
            type="button"
            aria-pressed={view === "mine"}
            onClick={openMyRecruitments}
          >
            내 참여
          </button>
        </div>

        <div className="board-tools">
          <div className="period-tabs" aria-label="주문 종류">
            <button
              className={period === "lunch" ? "active" : ""}
              type="button"
              aria-pressed={period === "lunch"}
              onClick={() => setPeriod("lunch")}
            >
              점심
              <small>13:00~14:00</small>
            </button>
            <button
              className={period === "cafe" ? "active" : ""}
              type="button"
              aria-pressed={period === "cafe"}
              onClick={() => setPeriod("cafe")}
            >
              카페
              <small>시간 자유</small>
            </button>
          </div>

          <label className="search-field">
            <span className="sr-only">음식점 또는 카테고리 검색</span>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="음식점 또는 카테고리 검색"
            />
          </label>
        </div>

        <div className="recruitment-list">
          {visibleRecruitments.map((recruitment) => (
            <RecruitmentCard key={recruitment.id} recruitment={recruitment} />
          ))}

          {visibleRecruitments.length === 0 && (
            <div className="empty-state">
              <strong>
                {view === "mine"
                  ? "참여 중인 모집이 없어요."
                  : "조건에 맞는 모집이 없어요."}
              </strong>
              <p>
                {view === "mine"
                  ? "전체 모집에서 참여하거나 새로운 모집을 만들어 보세요."
                  : "검색어를 바꾸거나 새로운 공동주문 모집을 만들어 보세요."}
              </p>
              {view === "mine" && (
                <button type="button" onClick={() => setView("all")}>
                  전체 모집 보기
                </button>
              )}
            </div>
          )}
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
        <span>mid-fi UX 구조 프로토타입 · 데이터는 예시입니다</span>
      </footer>
    </main>
  );
}
