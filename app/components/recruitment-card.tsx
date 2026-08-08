"use client";

import Link from "next/link";
import { Recruitment, getRestaurant } from "@/app/lib/prototype-data";
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
}: {
  recruitment: Recruitment;
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

  function handleParticipation() {
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
            onClick={handleParticipation}
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
