"use client";

import { useMemo, useState } from "react";
import { RecruitmentCard } from "@/app/components/recruitment-card";
import {
  OrderPeriod,
  getRestaurant,
  getRelativeTime,
  restaurantsForPeriod,
} from "@/app/lib/prototype-data";
import { usePrototype } from "@/app/prototype-context";

type BoardView = "all" | "mine";

export default function Home() {
  const {
    currentUser,
    recruitments,
    login,
    joinRecruitment,
    leaveRecruitment,
    cancelRecruitment,
    createRecruitment,
    requestRestaurant,
  } = usePrototype();

  const [period, setPeriod] = useState<OrderPeriod>("lunch");
  const [view, setView] = useState<BoardView>("all");
  const [query, setQuery] = useState("");

  // Slide-over Drawer states
  const [activeDrawerId, setActiveDrawerId] = useState<string | null>(null);
  const [isCreatingDrawer, setIsCreatingDrawer] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmType, setConfirmType] = useState<"leave" | "cancel">("leave");

  // New recruitment form states
  const [createPeriod, setCreatePeriod] = useState<OrderPeriod>("lunch");
  const [createSearch, setCreateSearch] = useState("");
  const [createRestaurantId, setCreateRestaurantId] = useState(
    restaurantsForPeriod("lunch")[0].id,
  );
  const [createDeadline, setCreateDeadline] = useState("12:30");

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

  const myJoinedRecruitments = useMemo(() => {
    if (!currentUser) return [];
    return recruitments.filter(
      (r) =>
        r.status === "open" &&
        r.participants.some((p) => p.id === currentUser.id),
    );
  }, [currentUser, recruitments]);

  // Drawer Active Recruitment Info
  const activeRecruitment = recruitments.find((r) => r.id === activeDrawerId);
  const activeRestaurant = activeRecruitment
    ? getRestaurant(activeRecruitment.restaurantId)
    : undefined;

  const isJoinedActive = Boolean(
    currentUser &&
      activeRecruitment?.participants.some((p) => p.id === currentUser.id),
  );
  const isManagerActive = currentUser?.id === activeRecruitment?.managerId;
  const sortedParticipants = activeRecruitment
    ? [...activeRecruitment.participants].sort((a, b) => a.joinedAt - b.joinedAt)
    : [];
  const nextManager = sortedParticipants.find((p) => p.id !== currentUser?.id);

  function handleDrawerParticipation() {
    if (!currentUser) {
      login();
      return;
    }
    if (!activeRecruitment) return;

    if (isJoinedActive) {
      if (isManagerActive && sortedParticipants.length > 1) {
        setConfirmType("leave");
        setShowConfirm(true);
        return;
      }
      leaveRecruitment(activeRecruitment.id);
    } else {
      joinRecruitment(activeRecruitment.id);
    }
  }

  function handleConfirmManagerAction() {
    if (!activeRecruitment) return;
    if (confirmType === "leave") {
      leaveRecruitment(activeRecruitment.id);
    } else {
      cancelRecruitment(activeRecruitment.id);
      setActiveDrawerId(null);
    }
    setShowConfirm(false);
  }

  // Create Form Helpers
  const availableCreateRestaurants = useMemo(() => {
    const norm = createSearch.trim().toLowerCase();
    return restaurantsForPeriod(createPeriod).filter((r) =>
      norm ? [r.name, r.category].some((v) => v.toLowerCase().includes(norm)) : true,
    );
  }, [createPeriod, createSearch]);

  const selectedCreateRestaurant = getRestaurant(createRestaurantId);

  function handleCreateSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!currentUser) {
      login();
      return;
    }
    const res = createRecruitment({
      restaurantId: createRestaurantId,
      period: createPeriod,
      deadline: createDeadline,
    });
    setIsCreatingDrawer(false);
    if (res.ok) {
      setActiveDrawerId(res.recruitmentId);
    } else {
      setActiveDrawerId(res.duplicateId);
    }
  }

  return (
    <main className="app-shell lounge-app-shell">
      {/* 🌟 1. Live Lounge Hero Header */}
      <section className="lounge-header-hero">
        <div className="lounge-hero-copy">
          <span className="lounge-live-badge">
            🟢 LIVE 시흥캠퍼스 런치 라운지 ({openRecruitments.length}개 룸 · 총 {participantTotal}명 참여 중)
          </span>
          <h1>실시간 모여밥 파티 라운지 🍱</h1>
          <p>
            원하는 파티룸을 클릭하면 <strong>페이지 이동 0초!</strong> 슬라이드오버
            드로어에서 파티원과 세부 정보를 실시간으로 확인하실 수 있습니다.
          </p>
        </div>

        <div className="lounge-hero-actions">
          <button
            type="button"
            className="lounge-create-trigger-btn"
            onClick={() => {
              setIsCreatingDrawer(true);
              setActiveDrawerId(null);
            }}
          >
            🚀 새 파티룸 만들기
          </button>
        </div>
      </section>

      {/* 🌟 2. Live Controls Navigation */}
      <nav className="lounge-nav-bar">
        <div className="lounge-tabs">
          <button
            type="button"
            className={period === "lunch" ? "active" : ""}
            onClick={() => setPeriod("lunch")}
          >
            점심 팟 🍱 (13:00~14:00)
          </button>
          <button
            type="button"
            className={period === "cafe" ? "active" : ""}
            onClick={() => setPeriod("cafe")}
          >
            카페 팟 ☕
          </button>
        </div>

        <div className="lounge-view-toggle">
          <button
            type="button"
            className={view === "all" ? "active" : ""}
            onClick={() => setView("all")}
          >
            전체 룸 ({openRecruitments.length})
          </button>
          <button
            type="button"
            className={view === "mine" ? "active" : ""}
            onClick={() => {
              if (!currentUser) login();
              setView("mine");
            }}
          >
            내 룸 ({myJoinedRecruitments.length})
          </button>
        </div>

        <label className="lounge-search-input">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="음식점 또는 메뉴 검색..."
          />
        </label>
      </nav>

      {/* 🌟 3. Live Lounge Rooms Grid */}
      <section className="lounge-rooms-grid">
        {visibleRecruitments.map((recruitment) => (
          <RecruitmentCard
            key={recruitment.id}
            recruitment={recruitment}
            onOpenDrawer={(id) => {
              setActiveDrawerId(id);
              setIsCreatingDrawer(false);
            }}
          />
        ))}

        {visibleRecruitments.length === 0 && (
          <div className="empty-lounge-box">
            <span>🚪</span>
            <strong>
              {view === "mine"
                ? "아직 참여 중인 파티룸이 없습니다."
                : "조건에 맞는 파티룸이 없습니다."}
            </strong>
            <p>직접 새로운 맛집 파티룸을 열어 구성원을 모아보세요!</p>
            <button
              type="button"
              className="lounge-create-trigger-btn"
              onClick={() => setIsCreatingDrawer(true)}
            >
              🚀 새 파티룸 만들기
            </button>
          </div>
        )}
      </section>

      {/* 🌟 4. Slide-over Party Room Drawer (페이지 이동 0초!) */}
      {activeRecruitment && activeRestaurant && (
        <div className="drawer-backdrop" onClick={() => setActiveDrawerId(null)}>
          <aside
            className="slide-over-drawer party-room-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="drawer-header">
              <div>
                <span className="category-chip">{activeRestaurant.category}</span>
                <h2>{activeRestaurant.name}</h2>
              </div>
              <button
                type="button"
                className="close-drawer-btn"
                onClick={() => setActiveDrawerId(null)}
              >
                ✕
              </button>
            </header>

            <div className="drawer-body">
              {/* Live Status & Quick Action Card */}
              <div className="drawer-status-card">
                <div>
                  <span>모집 상태</span>
                  <strong>
                    ⏰ {activeRecruitment.deadline} 마감 ({getRelativeTime(activeRecruitment.deadline)})
                  </strong>
                </div>

                {activeRecruitment.status === "open" && (
                  <button
                    type="button"
                    className={`drawer-action-btn ${isJoinedActive ? "joined" : ""}`}
                    onClick={handleDrawerParticipation}
                  >
                    {!currentUser
                      ? "Slack 로그인 후 참여"
                      : isJoinedActive
                        ? "참여 취소"
                        : "🚀 팟에 바로 참여하기"}
                  </button>
                )}
              </div>

              {/* Members Section */}
              <section className="drawer-section">
                <h3>👥 함께 주문하는 파티원 ({activeRecruitment.participants.length}명)</h3>
                {isJoinedActive ? (
                  <ul className="drawer-member-list">
                    {sortedParticipants.map((p) => (
                      <li key={p.id}>
                        <span className="avatar-chip">{p.name.slice(0, 1)}</span>
                        <strong>{p.name}</strong>
                        {p.id === activeRecruitment.managerId && (
                          <em className="manager-badge">모집 관리자</em>
                        )}
                        {p.id === currentUser?.id && <small className="me-badge">나</small>}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="private-notice-box">
                    🔒 파티원 정보는 팟 참여 후 확인하실 수 있습니다.
                  </div>
                )}
              </section>

              {/* Order Facts Section */}
              <section className="drawer-section">
                <h3>💳 주문 참고 정보</h3>
                <dl className="drawer-facts-grid">
                  <div>
                    <dt>예상 배달</dt>
                    <dd>⏱️ {activeRestaurant.estimatedDelivery}</dd>
                  </div>
                  <div>
                    <dt>최소 주문</dt>
                    <dd>💳 {activeRestaurant.minimumOrder.toLocaleString()}원</dd>
                  </div>
                  <div>
                    <dt>매장 평점</dt>
                    <dd>★ {activeRestaurant.rating}</dd>
                  </div>
                </dl>
              </section>

              {/* Representative Menus */}
              <section className="drawer-section">
                <h3>🍴 대표 메뉴 TOP 5</h3>
                <ul className="drawer-menu-list">
                  {activeRestaurant.representativeMenus.slice(0, 5).map((m) => (
                    <li key={m.name}>
                      <span>{m.name}</span>
                      <strong>{m.price.toLocaleString()}원</strong>
                    </li>
                  ))}
                </ul>
              </section>

              {/* Store Details */}
              <section className="drawer-section">
                <h3>🏢 매장 정보</h3>
                <p className="store-address-text">📍 {activeRestaurant.address}</p>
                <div className="store-meta-tags">
                  <span>운영: {activeRestaurant.businessHours}</span>
                  <span>휴무: {activeRestaurant.closedDays}</span>
                  <span>전화: {activeRestaurant.phone}</span>
                </div>
              </section>

              {/* Manager Actions */}
              {isManagerActive && activeRecruitment.status === "open" && (
                <section className="drawer-section manager-box">
                  <h3>⚙️ 모집 관리자 메뉴</h3>
                  <button
                    type="button"
                    className="cancel-recruitment-btn"
                    onClick={() => {
                      setConfirmType("cancel");
                      setShowConfirm(true);
                    }}
                  >
                    모집 전체 취소
                  </button>
                </section>
              )}

              {/* Slack Handoff Panel */}
              <div className="drawer-slack-handoff">
                <strong>💬 마감 후 Slack에서 대화를 이어가요</strong>
                <button
                  type="button"
                  className="slack-btn"
                  onClick={() => alert("Slack 대화방 자동 연동 기능은 권한 설정 후 연결될 예정입니다.")}
                >
                  Slack 대화방 이동 (준비 중)
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* 🌟 5. Slide-over New Party Creator Drawer */}
      {isCreatingDrawer && (
        <div className="drawer-backdrop" onClick={() => setIsCreatingDrawer(false)}>
          <aside
            className="slide-over-drawer party-create-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="drawer-header">
              <div>
                <h2>🚀 새 파티룸 만들기</h2>
                <p className="drawer-sub">음식점과 모집 마감 시간만 지정하면 됩니다.</p>
              </div>
              <button
                type="button"
                className="close-drawer-btn"
                onClick={() => setIsCreatingDrawer(false)}
              >
                ✕
              </button>
            </header>

            <form className="drawer-body" onSubmit={handleCreateSubmit}>
              <div className="form-group">
                <label className="group-label">1. 주문 종류</label>
                <div className="period-btn-group">
                  <button
                    type="button"
                    className={createPeriod === "lunch" ? "active" : ""}
                    onClick={() => {
                      setCreatePeriod("lunch");
                      setCreateRestaurantId(restaurantsForPeriod("lunch")[0].id);
                      setCreateDeadline("12:30");
                    }}
                  >
                    점심 🍱
                  </button>
                  <button
                    type="button"
                    className={createPeriod === "cafe" ? "active" : ""}
                    onClick={() => {
                      setCreatePeriod("cafe");
                      setCreateRestaurantId(restaurantsForPeriod("cafe")[0].id);
                      setCreateDeadline("14:30");
                    }}
                  >
                    카페 ☕
                  </button>
                </div>
              </div>

              <div className="form-group">
                <label className="group-label">2. 음식점 선택</label>
                <input
                  type="search"
                  className="create-search-input"
                  placeholder="음식점 검색..."
                  value={createSearch}
                  onChange={(e) => setCreateSearch(e.target.value)}
                />
                <div className="create-restaurant-list">
                  {availableCreateRestaurants.map((r) => (
                    <label
                      key={r.id}
                      className={createRestaurantId === r.id ? "selected" : ""}
                    >
                      <input
                        type="radio"
                        name="restaurant-choice"
                        value={r.id}
                        checked={createRestaurantId === r.id}
                        onChange={() => setCreateRestaurantId(r.id)}
                      />
                      <span>{r.name} ({r.category})</span>
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  className="request-store-btn"
                  onClick={requestRestaurant}
                >
                  찾는 매장이 없나요? 매장 추가 요청 →
                </button>
              </div>

              <div className="form-group">
                <label className="group-label">3. 모집 마감 시간</label>
                <div className="time-presets-chips">
                  {(createPeriod === "lunch"
                    ? ["12:20", "12:30", "12:40", "12:50"]
                    : ["14:00", "14:30", "15:00", "15:30"]
                  ).map((time) => (
                    <button
                      key={time}
                      type="button"
                      className={createDeadline === time ? "active" : ""}
                      onClick={() => setCreateDeadline(time)}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                <input
                  type="time"
                  className="time-picker-input"
                  value={createDeadline}
                  onChange={(e) => setCreateDeadline(e.target.value)}
                  required
                />
              </div>

              <div className="create-summary-banner">
                <span>선택 요약</span>
                <strong>{selectedCreateRestaurant?.name}</strong>
                <small>{createPeriod === "lunch" ? "점심" : "카페"} · {createDeadline} 마감</small>
              </div>

              <button
                type={currentUser ? "submit" : "button"}
                className="submit-create-room-btn"
                onClick={currentUser ? undefined : login}
              >
                {currentUser ? "🚀 파티룸 개설하기" : "Slack 로그인 후 개설"}
              </button>
            </form>
          </aside>
        </div>
      )}

      {/* Confirm Modal Overlay */}
      {showConfirm && (
        <div className="confirm-modal-overlay">
          <div className="confirm-modal">
            <h3>{confirmType === "leave" ? "관리자 참여 취소" : "모집 전체 취소"}</h3>
            <p>
              {confirmType === "leave"
                ? nextManager
                  ? `참여를 취소하시면 [${nextManager.name}]님에게 관리자 역할이 자동 이임됩니다.`
                  : "참여자가 0명이 되므로 모집이 자동으로 취소됩니다."
                : "진행 중인 이 모집을 전체 취소하시겠습니까?"}
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="cancel-btn"
                onClick={() => setShowConfirm(false)}
              >
                돌아가기
              </button>
              <button
                type="button"
                className="confirm-btn"
                onClick={handleConfirmManagerAction}
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      <footer>
        <div className="brand footer-brand">
          <span className="brand-mark" aria-hidden="true">
            ㅁ
          </span>
          <span>모여밥</span>
        </div>
        <p>시흥캠퍼스의 실시간 공동주문을 더 쉽게.</p>
        <span>Live Lounge & Slide-over Drawer Prototype · 예시 데이터</span>
      </footer>
    </main>
  );
}

