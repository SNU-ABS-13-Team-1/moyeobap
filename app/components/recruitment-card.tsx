"use client";

import Link from "next/link";
import {
  Recruitment,
  getRestaurant,
  getRelativeTime,
} from "@/app/lib/prototype-data";
import { usePrototype } from "@/app/prototype-context";

const statusLabel = {
  open: "참여 가능",
  "handoff-pending": "모집 마감",
  "handoff-complete": "Slack 인계 완료",
  closed: "자동 종료",
  cancelled: "모집 취소",
} as const;

export function RecruitmentCard({
  recruitment,
  onOpenDrawer,
}: {
  recruitment: Recruitment;
  onOpenDrawer?: (id: string) => void;
}) {
  const { currentUser, joinRecruitment, leaveRecruitment, login } =
    usePrototype();
  const restaurant = getRestaurant(recruitment.restaurantId);
  if (!restaurant) return null;

  const isJoined = Boolean(
    currentUser &&
      recruitment.participants.some(
        (participant) => participant.id === currentUser.id,
      ),
  );
  const isOpen = recruitment.status === "open";
  const relativeTime = getRelativeTime(recruitment.deadline);

  function handleQuickJoin(e: React.MouseEvent<HTMLButtonElement>) {
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
  }

  // Standard Main Branch Card Mode (No drawer handler passed)
  if (!onOpenDrawer) {
    return (
      <article className={`recruitment-card status-${recruitment.status}`}>
        <Link className="card-link" href={`/recruitments/${recruitment.id}`}>
          <div className="card-status">
            <span>{statusLabel[recruitment.status]}</span>
            <strong>{recruitment.deadline} 마감</strong>
            {isJoined && <em>내가 참여 중</em>}
          </div>

          <div className="restaurant-heading">
            <span className="category-chip">{restaurant.category}</span>
            <h3>{restaurant.name}</h3>
          </div>
          <p className="card-summary">
            대표 메뉴 {restaurant.representativeMenus[0]?.name} · 예상 배달{" "}
            {restaurant.estimatedDelivery}
          </p>
          <span className="detail-affordance">모집 상세 보기 →</span>
        </Link>

        <div className="participation-panel">
          <span>현재 참여</span>
          <strong>
            {recruitment.participants.length}
            <small>명</small>
          </strong>
          {isOpen ? (
            <button
              className={isJoined ? "joined" : ""}
              type="button"
              onClick={handleQuickJoin}
            >
              {!currentUser
                ? "로그인 후 참여"
                : isJoined
                  ? "참여 취소"
                  : "참여하기"}
            </button>
          ) : (
            <span className="closed-caption">참여가 마감됐어요</span>
          )}
        </div>
      </article>
    );
  }

  // Drawer / Lounge Mode Card
  return (
    <article
      className={`lounge-room-card status-${recruitment.status} ${
        isJoined ? "joined-lounge-room" : ""
      }`}
      onClick={() => onOpenDrawer?.(recruitment.id)}
    >
      <header className="room-card-top">
        <div className="room-status-badge">
          <span className="live-pulse-dot" />
          <strong>{statusLabel[recruitment.status]}</strong>
        </div>
        <span className="category-chip">{restaurant.category}</span>
      </header>

      <div className="room-card-main">
        <div className="card-title-row">
          <h3>{restaurant.name}</h3>
          {isJoined && <span className="my-party-badge">참여중</span>}
        </div>
        <p className="room-menu-summary">
          🍴 {restaurant.representativeMenus[0]?.name} ({restaurant.representativeMenus[0]?.price.toLocaleString()}원)
        </p>

        <div className="room-facts-row">
          <span className="time-tag">⏰ {recruitment.deadline} 마감</span>
          {isOpen && relativeTime && (
            <span className={`relative-tag ${relativeTime.includes("임박") ? "urgent" : ""}`}>
              {relativeTime}
            </span>
          )}
        </div>
      </div>

      <footer className="room-card-bottom">
        <div className="lounge-members-stack">
          <div className="members-count-badge">
            <span className="party-fire-icon">🔥</span>
            <strong>{recruitment.participants.length}명</strong>
            <span className="members-label">모임 중</span>
          </div>
        </div>

        <div className="room-action-buttons">
          {isOpen && (
            <button
              type="button"
              className={`quick-join-pill ${isJoined ? "joined" : ""}`}
              onClick={handleQuickJoin}
            >
              {isJoined ? "참여 취소" : "팟 탑승"}
            </button>
          )}
          <button
            type="button"
            className="enter-room-btn"
            onClick={(e) => {
              e.stopPropagation();
              onOpenDrawer?.(recruitment.id);
            }}
          >
            상세 보기
          </button>
        </div>
      </footer>
    </article>
  );
}
