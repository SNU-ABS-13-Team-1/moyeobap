"use client";

import {
  Recruitment,
  getRestaurant,
  getRelativeTime,
} from "@/app/lib/prototype-data";
import { usePrototype } from "@/app/prototype-context";

const statusLabel = {
  open: "모집 중",
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

