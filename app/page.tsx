"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { RecruitmentCard } from "@/app/components/recruitment-card";
import {
  OrderPeriod,
  getRestaurant,
  getRelativeTime,
  restaurantsForPeriod,
} from "@/app/lib/prototype-data";
import { usePrototype } from "@/app/prototype-context";
import { ConceptMode } from "@/app/components/concept-switcher";

type BoardView = "all" | "mine";

export default function Home() {
  const searchParams = useSearchParams();
  const concept = (searchParams.get("concept") as ConceptMode) || "live-lounge";

  const {
    currentUser,
    recruitments,
    login,
    logout,
    joinRecruitment,
    leaveRecruitment,
    cancelRecruitment,
    createRecruitment,
    requestRestaurant,
  } = usePrototype();

  const [period, setPeriod] = useState<OrderPeriod>("lunch");
  const [view, setView] = useState<BoardView>("all");
  const [query, setQuery] = useState("");
  const [selectedMood, setSelectedMood] = useState<string>("all");

  // Roulette States
  const [isSpinning, setIsSpinning] = useState(false);
  const [winnerId, setWinnerId] = useState<string | null>(null);

  // Split View Selected Recruitment
  const [selectedId, setSelectedId] = useState<string | null>(null);

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

  const moodFilterOptions = [
    { label: "전체", value: "all" },
    { label: "🔥 매콤·칼칼", value: "매콤" },
    { label: "🥗 가볍·클린", value: "가볍" },
    { label: "🍱 든든·바삭", value: "든든" },
    { label: "🍲 뜨끈·국물", value: "국물" },
    { label: "☕ 디저트·카페", value: "커피" },
  ];

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
        if (!restaurant) return false;

        if (concept === "roulette" && selectedMood !== "all") {
          const hasMood = restaurant.moodTags?.some((t) =>
            t.includes(selectedMood),
          );
          if (!hasMood) return false;
        }

        if (!normalizedQuery) return true;
        return [restaurant.name, restaurant.category].some((value) =>
          value.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
  }, [currentUser, period, query, recruitments, view, concept, selectedMood]);

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

  function spinRoulette() {
    if (openRecruitments.length === 0) return;
    setIsSpinning(true);
    setWinnerId(null);

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * openRecruitments.length);
      const winner = openRecruitments[randomIndex];
      setWinnerId(winner.id);
      setIsSpinning(false);
      setActiveDrawerId(winner.id);
    }, 1200);
  }

  function openMyRecruitments() {
    if (!currentUser) {
      login();
    }
    setView("mine");
  }

  // ---------------------------------------------------------------------------
  // CONCEPT: Hot Dashboard (🔥 마감임박 카운트다운 + 테이블 뷰)
  // ---------------------------------------------------------------------------
  if (concept === "hot-dashboard") {
    const now = new Date();
    const currentTimeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

    return (
      <div className="min-h-screen bg-[#f6f7fb]">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-green-600 flex items-center gap-2">
                🍚 모여밥
              </h1>
              <p className="text-sm text-gray-500">같이 먹으면 더 맛있는 점심</p>
            </div>

            <button
              type="button"
              onClick={currentUser ? logout : login}
              className="bg-[#4A154B] hover:bg-[#3b113c] text-white px-5 py-2 rounded-lg font-medium transition"
            >
              {currentUser ? `${currentUser.name} (Slack)` : "Slack 로그인"}
            </button>
          </div>
        </header>

        {/* Main */}
        <main className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats */}
          <section className="grid md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-gray-500 text-sm">진행중 모집</p>
              <h2 className="text-3xl font-bold mt-2">{openRecruitments.length}개</h2>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-gray-500 text-sm">참여 인원</p>
              <h2 className="text-3xl font-bold mt-2">{participantTotal}명</h2>
            </div>

            <div className="bg-white rounded-2xl p-5 shadow-sm">
              <p className="text-gray-500 text-sm">현재 시각</p>
              <h2 className="text-3xl font-bold mt-2">{currentTimeStr}</h2>
            </div>
          </section>

          {/* Filter */}
          <section className="flex gap-3 mb-8">
            <button
              type="button"
              className={`px-6 py-3 rounded-xl font-medium transition ${
                period === "lunch"
                  ? "bg-green-600 text-white"
                  : "bg-white border text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setPeriod("lunch")}
            >
              점심 🍱
            </button>

            <button
              type="button"
              className={`px-6 py-3 rounded-xl font-medium transition ${
                period === "cafe"
                  ? "bg-green-600 text-white"
                  : "bg-white border text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setPeriod("cafe")}
            >
              카페 ☕
            </button>
          </section>

          {/* Hot Section */}
          <section className="mb-10">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                🔥 마감 임박
              </h2>

              <button
                type="button"
                className="text-green-600 font-medium hover:underline text-sm"
                onClick={() => setView("all")}
              >
                전체보기
              </button>
            </div>

            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {visibleRecruitments.slice(0, 3).map((recruitment, index) => {
                const res = getRestaurant(recruitment.restaurantId);
                const count = recruitment.participants.length;
                const pct = Math.min(Math.round((count / 5) * 100), 100);
                const isJoined = Boolean(
                  currentUser &&
                    recruitment.participants.some((p) => p.id === currentUser.id),
                );

                const isHot = index === 0;
                const timerColor = isHot
                  ? "text-red-500 countdown"
                  : count >= 3
                  ? "text-yellow-500"
                  : "text-green-500";

                const barColor = isHot
                  ? "bg-red-500"
                  : count >= 3
                  ? "bg-yellow-500"
                  : "bg-green-500";

                return (
                  <div
                    key={recruitment.id}
                    className={`bg-white rounded-3xl p-5 shadow-sm card-hover cursor-pointer ${
                      isHot ? "hot-card" : ""
                    }`}
                    onClick={() => setActiveDrawerId(recruitment.id)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-bold text-xl text-gray-900">
                          {res?.name}
                        </h3>
                        <p className="text-gray-500 text-sm mt-0.5">{res?.category}</p>
                      </div>

                      <div className="text-right">
                        <p className={`text-3xl font-bold ${timerColor}`}>
                          {getRelativeTime(recruitment.deadline) || "마감"}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {recruitment.deadline} 마감
                        </p>
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className="flex justify-between text-sm mb-2 font-medium text-gray-700">
                        <span>👥 {count}명 참여중</span>
                        <span>{pct}%</span>
                      </div>

                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} transition-all duration-300`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      className={`w-full mt-5 text-white py-3 rounded-xl font-semibold transition ${
                        isJoined
                          ? "bg-gray-600 hover:bg-gray-700"
                          : "bg-green-600 hover:bg-green-700"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!currentUser) {
                          login();
                          return;
                        }
                        if (isJoined) {
                          leaveRecruitment(recruitment.id);
                        } else {
                          joinRecruitment(recruitment.id);
                        }
                      }}
                    >
                      {isJoined ? "참여 취소" : "탑승하기"}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          {/* All Pots Section */}
          <section>
            <div className="flex justify-between items-center mb-5">
              <h2 className="text-xl font-bold text-gray-900">
                전체 모집 ({visibleRecruitments.length})
              </h2>

              <button
                type="button"
                className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-xl font-medium transition"
                onClick={() => {
                  setIsCreatingDrawer(true);
                  setActiveDrawerId(null);
                }}
              >
                + 새 팟 만들기
              </button>
            </div>

            <div className="bg-white rounded-3xl shadow-sm overflow-hidden border">
              <table className="w-full text-left">
                <thead className="bg-gray-50 text-gray-600 text-sm">
                  <tr>
                    <th className="p-4 font-semibold">매장</th>
                    <th className="p-4 font-semibold">인원</th>
                    <th className="p-4 font-semibold">남은시간</th>
                    <th className="p-4 font-semibold">상태</th>
                    <th className="p-4 font-semibold text-right">상세</th>
                  </tr>
                </thead>

                <tbody className="divide-y text-sm">
                  {visibleRecruitments.map((recruitment) => {
                    const res = getRestaurant(recruitment.restaurantId);
                    const rel = getRelativeTime(recruitment.deadline);
                    const count = recruitment.participants.length;

                    let statusBadge = (
                      <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                        여유
                      </span>
                    );

                    if (rel.includes("임박")) {
                      statusBadge = (
                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                          임박
                        </span>
                      );
                    } else if (count >= 3) {
                      statusBadge = (
                        <span className="bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold">
                          모집중
                        </span>
                      );
                    }

                    return (
                      <tr
                        key={recruitment.id}
                        className="hover:bg-gray-50 transition cursor-pointer"
                        onClick={() => setActiveDrawerId(recruitment.id)}
                      >
                        <td className="p-4 font-bold text-gray-900">
                          {res?.name}
                        </td>
                        <td className="p-4 text-gray-700 font-medium">
                          {count}명
                        </td>
                        <td className="p-4 text-gray-700 font-medium">
                          {rel} ({recruitment.deadline})
                        </td>
                        <td className="p-4">{statusBadge}</td>
                        <td className="p-4 text-right">
                          <button
                            type="button"
                            className="text-green-600 font-semibold hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveDrawerId(recruitment.id);
                            }}
                          >
                            보기 →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </main>

        {/* Floating Create Button */}
        <button
          type="button"
          aria-label="새 팟 만들기"
          className="fixed bottom-6 right-6 w-16 h-16 rounded-full bg-green-600 text-white text-3xl shadow-lg hover:scale-105 transition flex items-center justify-center z-30"
          onClick={() => {
            setIsCreatingDrawer(true);
            setActiveDrawerId(null);
          }}
        >
          +
        </button>

        {renderDrawerComponents()}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // CONCEPT 1: Live Lounge View (SPA Drawer)
  // ---------------------------------------------------------------------------
  if (concept === "live-lounge") {
    return (
      <main className="app-shell lounge-app-shell">
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

        {renderDrawerComponents()}
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // CONCEPT 2: Lunch Roulette View
  // ---------------------------------------------------------------------------
  if (concept === "roulette") {
    return (
      <main className="app-shell roulette-shell">
        <section className="roulette-hero">
          <div className="roulette-hero-content">
            <span className="hero-eyebrow">오늘의 점심 메뉴 결정 장애 해결!</span>
            <h1>&quot;오늘 뭐 먹지?&quot; 고민된다면 룰렛을 돌려보세요! 🎰</h1>
            <p>
              시흥캠퍼스 구성원들이 함께 모집 중인 맛집 중 하나를 룰렛으로 추천해 드립니다.
            </p>

            <button
              type="button"
              className={`spin-roulette-btn ${isSpinning ? "spinning" : ""}`}
              onClick={spinRoulette}
              disabled={isSpinning || openRecruitments.length === 0}
            >
              {isSpinning ? "🎰 룰렛 돌아가는 중...!!" : "🎰 오늘의 메뉴 룰렛 돌리기!"}
            </button>
          </div>

          <div className="roulette-hero-summary">
            <div>
              <span>열려있는 공동주문</span>
              <strong>{openRecruitments.length}개</strong>
            </div>
            <div>
              <span>총 참여 인원</span>
              <strong>{participantTotal}명</strong>
            </div>
          </div>
        </section>

        <section className="mood-filter-section" style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "18px", padding: "16px 20px", marginBottom: "24px" }}>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#666", marginRight: "12px" }}>🏷️ 오늘 땡기는 기분/취향:</span>
          <div style={{ display: "inline-flex", gap: "8px", flexWrap: "wrap" }}>
            {moodFilterOptions.map((mood) => (
              <button
                key={mood.value}
                type="button"
                className={`mood-chip ${selectedMood === mood.value ? "active" : ""}`}
                onClick={() => setSelectedMood(mood.value)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "999px",
                  border: selectedMood === mood.value ? "2px solid #312e81" : "1px solid #e0e0e0",
                  background: selectedMood === mood.value ? "#312e81" : "#fff",
                  color: selectedMood === mood.value ? "#fff" : "#444",
                  fontWeight: selectedMood === mood.value ? "700" : "500",
                  fontSize: "12px",
                  cursor: "pointer",
                }}
              >
                {mood.label}
              </button>
            ))}
          </div>
        </section>

        <section className="board-grid">
          {visibleRecruitments.map((recruitment) => (
            <RecruitmentCard
              key={recruitment.id}
              recruitment={recruitment}
              onOpenDrawer={(id) => setActiveDrawerId(id)}
            />
          ))}
        </section>

        {renderDrawerComponents()}
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // CONCEPT 3: Sticky Note & Visual Pinboard View
  // ---------------------------------------------------------------------------
  if (concept === "pinboard") {
    return (
      <main className="app-shell pinboard-shell">
        <section className="pinboard-hero">
          <div className="hero-badge">📌 시흥캠퍼스 모여밥 핀보드</div>
          <h1>오늘 어떤 메뉴 핀하시겠어요? 📌</h1>
          <p>함께 주문할 팀원을 찾고 스티키 메모에서 클릭 한 번으로 빠르게 참여해 보세요.</p>

          <div className="pinboard-briefing">
            <div className="brief-pill">
              <span>진행 중 모집</span>
              <strong>{openRecruitments.length}개</strong>
            </div>
            <div className="brief-pill">
              <span>참여 멤버</span>
              <strong>{participantTotal}명</strong>
            </div>
            {currentUser && (
              <div className="brief-pill my-pill">
                <span>내 참여 중</span>
                <strong>{myJoinedRecruitments.length}개</strong>
              </div>
            )}
          </div>
        </section>

        <nav className="sticky-control-bar">
          <div className="pill-tabs-group">
            <button
              className={view === "all" ? "pill-btn active" : "pill-btn"}
              onClick={() => setView("all")}
            >
              전체 모집 ({openRecruitments.length})
            </button>
            <button
              className={view === "mine" ? "pill-btn active" : "pill-btn"}
              onClick={() => {
                if (!currentUser) login();
                setView("mine");
              }}
            >
              내 참여 모집 ({myJoinedRecruitments.length})
            </button>
          </div>

          <label className="sticky-search" style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--surface-soft)", padding: "6px 12px", borderRadius: "999px", border: "1px solid var(--line)" }}>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="스티키 핀 검색..."
              style={{ border: 0, background: "transparent", outline: "none", fontSize: "12px" }}
            />
          </label>
        </nav>

        <section className="pinboard-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px" }}>
          {visibleRecruitments.map((recruitment) => (
            <RecruitmentCard
              key={recruitment.id}
              recruitment={recruitment}
              onOpenDrawer={(id) => setActiveDrawerId(id)}
            />
          ))}
        </section>

        {renderDrawerComponents()}
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // CONCEPT 4: 2-Column Split Dashboard View
  // ---------------------------------------------------------------------------
  if (concept === "split-dashboard") {
    const activeItem = recruitments.find((r) => r.id === (selectedId || visibleRecruitments[0]?.id));
    const activeRes = activeItem ? getRestaurant(activeItem.restaurantId) : undefined;

    return (
      <main className="app-shell dashboard-shell" style={{ maxWidth: "1240px", margin: "0 auto", padding: "24px 20px 80px" }}>
        <section className="dashboard-hero" style={{ background: "linear-gradient(135deg, #17201c 0%, #24352b 100%)", borderRadius: "24px", padding: "32px", color: "white", marginBottom: "28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="hero-heading">
            <span className="eyebrow" style={{ color: "#86efac", fontSize: "11px", fontWeight: "800" }}>실시간 시흥캠퍼스 대시보드</span>
            <h1 style={{ fontSize: "28px", margin: "6px 0" }}>마감 전에 함께 주문해요 🍱</h1>
            <p style={{ color: "rgba(255,255,255,0.75)", fontSize: "14px" }}>좌측에서 원하는 모집을 선택하면 우측에서 즉시 상세 정보를 비교할 수 있습니다.</p>
          </div>

          <div className="hero-stats" style={{ display: "flex", gap: "16px" }}>
            <div className="stat-card" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", padding: "16px 20px", borderRadius: "16px", textAlign: "center" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>진행 중인 모집</span>
              <strong style={{ display: "block", fontSize: "22px" }}>{openRecruitments.length}개</strong>
            </div>
            <div className="stat-card" style={{ background: "rgba(255,255,255,0.1)", backdropFilter: "blur(10px)", padding: "16px 20px", borderRadius: "16px", textAlign: "center" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.7)" }}>총 참여 인원</span>
              <strong style={{ display: "block", fontSize: "22px" }}>{participantTotal}명</strong>
            </div>
          </div>
        </section>

        <div className="dashboard-split-layout" style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "24px", alignItems: "start" }}>
          {/* Left Column */}
          <div className="split-list-col" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {visibleRecruitments.map((recruitment) => {
              const res = getRestaurant(recruitment.restaurantId);
              const isSel = (selectedId || visibleRecruitments[0]?.id) === recruitment.id;
              return (
                <div
                  key={recruitment.id}
                  onClick={() => setSelectedId(recruitment.id)}
                  style={{
                    padding: "20px",
                    borderRadius: "16px",
                    background: isSel ? "#e5f1e9" : "#ffffff",
                    border: isSel ? "2px solid #246b4a" : "1px solid #dce2dd",
                    cursor: "pointer",
                    boxShadow: isSel ? "0 4px 14px rgba(36,107,74,0.12)" : "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                    <span style={{ fontSize: "12px", color: "#66716b", fontWeight: "600" }}>{res?.category}</span>
                    <span style={{ fontSize: "12px", color: "#c65f32", fontWeight: "800" }}>⏰ {recruitment.deadline} 마감</span>
                  </div>
                  <h3 style={{ margin: "0 0 8px 0", fontSize: "17px", fontWeight: "800", color: "#17201c" }}>{res?.name}</h3>
                  <div style={{ fontSize: "13px", color: "#246b4a", fontWeight: "700" }}>
                    👥 {recruitment.participants.length}명 참여 중
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column */}
          {activeItem && activeRes ? (
            <div className="split-detail-col" style={{ background: "#ffffff", padding: "28px", borderRadius: "20px", border: "1px solid #dce2dd", boxShadow: "0 8px 24px rgba(0,0,0,0.04)", position: "sticky", top: "80px" }}>
              <span style={{ background: "#e5f1e9", color: "#174b34", padding: "4px 12px", borderRadius: "999px", fontSize: "12px", fontWeight: "800" }}>
                {activeRes.category}
              </span>
              <h2 style={{ fontSize: "28px", fontWeight: "850", margin: "14px 0 6px 0", color: "#17201c" }}>{activeRes.name}</h2>
              <p style={{ color: "#66716b", fontSize: "14px", margin: "0 0 20px 0" }}>⏰ {activeItem.deadline} 마감 ({getRelativeTime(activeItem.deadline)})</p>

              <hr style={{ margin: "20px 0", border: "none", borderTop: "1px solid #e5e8e5" }} />

              <h4 style={{ margin: "16px 0 10px 0", fontSize: "15px", color: "#17201c" }}>👥 함께하는 파티원 ({activeItem.participants.length}명)</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", display: "flex", flexDirection: "column", gap: "8px" }}>
                {activeItem.participants.map((p) => (
                  <li key={p.id} style={{ padding: "8px 12px", background: "#f4f6f3", borderRadius: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                    <span>👤 <strong>{p.name}</strong></span>
                    {p.id === activeItem.managerId && <span style={{ color: "#c65f32", fontSize: "11px", fontWeight: "800", background: "#fef2f2", padding: "2px 8px", borderRadius: "999px" }}>모집 관리자</span>}
                  </li>
                ))}
              </ul>

              <h4 style={{ margin: "16px 0 10px 0", fontSize: "15px", color: "#17201c" }}>🍴 대표 메뉴</h4>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px 0", display: "flex", flexDirection: "column", gap: "6px" }}>
                {activeRes.representativeMenus.slice(0, 5).map((m) => (
                  <li key={m.name} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px dashed #eee", fontSize: "13px" }}>
                    <span>{m.name}</span>
                    <strong style={{ color: "#17201c" }}>{m.price.toLocaleString()}원</strong>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setActiveDrawerId(activeItem.id)}
                style={{ width: "100%", padding: "16px", background: "#246b4a", color: "#ffffff", border: "none", borderRadius: "14px", fontSize: "15px", fontWeight: "800", cursor: "pointer", boxShadow: "0 6px 16px rgba(36,107,74,0.2)" }}
              >
                🚀 파티원 상세보기 및 참여 관리
              </button>
            </div>
          ) : null}
        </div>

        {renderDrawerComponents()}
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // CONCEPT 5: Quick Match Deck View
  // ---------------------------------------------------------------------------
  if (concept === "quick-deck") {
    const topRecruitment = visibleRecruitments[0];
    const topRestaurant = topRecruitment ? getRestaurant(topRecruitment.restaurantId) : undefined;

    return (
      <main className="app-shell" style={{ maxWidth: "900px", margin: "0 auto", padding: "24px 20px 80px" }}>
        <section style={{ textAlign: "center", marginBottom: "32px" }}>
          <span style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "4px 14px", borderRadius: "999px", fontSize: "11px", fontWeight: "800" }}>⚡️ 마감 임박 퀵 매칭 덱</span>
          <h1 style={{ fontSize: "32px", fontWeight: "850", margin: "10px 0 8px 0" }}>가장 빨리 출발하는 배달 팟 🚀</h1>
          <p style={{ color: "#66716b", fontSize: "15px" }}>고민 없이 가장 마감이 임박한 파티룸에 원클릭으로 탑승하세요!</p>
        </section>

        {topRecruitment && topRestaurant ? (
          <div style={{ background: "linear-gradient(135deg, #174b34 0%, #246b4a 100%)", color: "#fff", padding: "36px", borderRadius: "28px", boxShadow: "0 16px 40px rgba(36,107,74,0.25)", marginBottom: "40px" }}>
            <span style={{ background: "rgba(255,255,255,0.18)", backdropFilter: "blur(8px)", padding: "5px 14px", borderRadius: "999px", fontSize: "12px", fontWeight: "800" }}>
              ⏱️ {topRecruitment.deadline} 마감 임박
            </span>
            <h2 style={{ fontSize: "34px", fontWeight: "850", margin: "18px 0 8px 0" }}>{topRestaurant.name}</h2>
            <p style={{ opacity: 0.88, fontSize: "14px", marginBottom: "24px" }}>카테고리: {topRestaurant.category} · 대표메뉴: {topRestaurant.representativeMenus[0]?.name}</p>

            <button
              type="button"
              onClick={() => setActiveDrawerId(topRecruitment.id)}
              style={{ width: "100%", padding: "18px", background: "#ffffff", color: "#174b34", border: "none", borderRadius: "16px", fontSize: "17px", fontWeight: "850", cursor: "pointer", boxShadow: "0 8px 20px rgba(0,0,0,0.15)" }}
            >
              🚀 지금 바로 탑승하기 ({topRecruitment.participants.length}명 참여 중)
            </button>
          </div>
        ) : null}

        <h3 style={{ margin: "0 0 20px 0", fontSize: "18px", fontWeight: "800" }}>전체 모집 목록</h3>
        <section className="board-grid">
          {visibleRecruitments.map((recruitment) => (
            <RecruitmentCard
              key={recruitment.id}
              recruitment={recruitment}
              onOpenDrawer={(id) => setActiveDrawerId(id)}
            />
          ))}
        </section>

        {renderDrawerComponents()}
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // CONCEPT 6: Classic Main View (Exact Baseline from main branch)
  // ---------------------------------------------------------------------------
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

  // Helper renderer for drawers & modals
  function renderDrawerComponents() {
    return (
      <>
        {/* Slide-over Party Room Drawer */}
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

                <section className="drawer-section">
                  <h3>🏢 매장 정보</h3>
                  <p className="store-address-text">📍 {activeRestaurant.address}</p>
                  <div className="store-meta-tags">
                    <span>운영: {activeRestaurant.businessHours}</span>
                    <span>휴무: {activeRestaurant.closedDays}</span>
                    <span>전화: {activeRestaurant.phone}</span>
                  </div>
                </section>

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

        {/* Slide-over New Party Creator Drawer */}
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
      </>
    );
  }
}
