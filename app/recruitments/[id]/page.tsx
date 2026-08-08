"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useRecruitment } from "@/app/prototype-context";

const money = new Intl.NumberFormat("ko-KR");

const statusLabel = {
  open: "참여 가능",
  "handoff-pending": "모집 마감",
  "handoff-complete": "Slack 인계 완료",
  closed: "자동 종료",
  cancelled: "모집 취소",
} as const;

export default function RecruitmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const {
    currentUser,
    recruitment,
    restaurant,
    login,
    joinRecruitment,
    leaveRecruitment,
    cancelRecruitment,
  } = useRecruitment(params.id);

  if (!recruitment || !restaurant) {
    return (
      <main className="page-shell narrow-shell">
        <div className="empty-state standalone-empty">
          <strong>모집을 찾을 수 없어요.</strong>
          <p>이미 종료되었거나 존재하지 않는 모집입니다.</p>
          <Link href="/">현황판으로 돌아가기</Link>
        </div>
      </main>
    );
  }

  const recruitmentId = recruitment.id;

  const isJoined = Boolean(
    currentUser &&
      recruitment.participants.some(
        (participant) => participant.id === currentUser.id,
      ),
  );
  const isManager = currentUser?.id === recruitment.managerId;
  const isOpen = recruitment.status === "open";
  const sortedParticipants = [...recruitment.participants].sort(
    (a, b) => a.joinedAt - b.joinedAt,
  );

  function handleParticipation() {
    if (!currentUser) {
      login();
      return;
    }
    if (isJoined) {
      leaveRecruitment(recruitmentId);
      router.push("/");
    } else {
      joinRecruitment(recruitmentId);
    }
  }

  function handleCancelRecruitment() {
    cancelRecruitment(recruitmentId);
    router.push("/");
  }

  return (
    <main className="page-shell detail-shell">
      <Link className="back-link" href="/">
        ← 실시간 현황판
      </Link>

      <article className="detail-card">
        <header className="detail-hero">
          <div className="detail-status">
            <span>{statusLabel[recruitment.status]}</span>
            <strong>{recruitment.deadline} 마감</strong>
          </div>
          <span className="category-chip">{restaurant.category}</span>
          <h1>{restaurant.name}</h1>
          <p>{restaurant.address}</p>

          <div className="detail-participation">
            <div>
              <span>현재 참여</span>
              <strong>
                {recruitment.participants.length}
                <small>명</small>
              </strong>
            </div>
            {isOpen && (
              <button
                className={isJoined ? "secondary-action" : "primary-action"}
                type="button"
                onClick={handleParticipation}
              >
                {!currentUser
                  ? "Slack 로그인 후 참여"
                  : isJoined
                    ? "참여 취소"
                    : "참여하기"}
              </button>
            )}
          </div>
        </header>

        <section className="detail-section" aria-labelledby="order-info-title">
          <div className="section-heading-row">
            <div>
              <span className="section-label">ORDER INFO</span>
              <h2 id="order-info-title">주문 참고 정보</h2>
            </div>
            <p>메뉴 선택과 실제 주문은 이 웹에서 진행하지 않아요.</p>
          </div>

          <dl className="key-facts">
            <div>
              <dt>예상 배달</dt>
              <dd>{restaurant.estimatedDelivery}</dd>
            </div>
            <div>
              <dt>최소 주문</dt>
              <dd>{money.format(restaurant.minimumOrder)}원</dd>
            </div>
            <div>
              <dt>매장 평점</dt>
              <dd>★ {restaurant.rating}</dd>
            </div>
          </dl>

          <div className="menu-section">
            <h3>대표 메뉴</h3>
            <ul>
              {restaurant.representativeMenus.slice(0, 5).map((menu) => (
                <li key={menu.name}>
                  <span>{menu.name}</span>
                  <strong>{money.format(menu.price)}원</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="detail-section" aria-labelledby="store-info-title">
          <span className="section-label">STORE INFO</span>
          <h2 id="store-info-title">매장 정보</h2>
          <dl className="store-info-grid">
            <div>
              <dt>주소</dt>
              <dd>{restaurant.address}</dd>
            </div>
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
        </section>

        <section className="detail-section" aria-labelledby="participants-title">
          <span className="section-label">PARTICIPANTS</span>
          <h2 id="participants-title">함께 주문하는 사람</h2>

          {isJoined ? (
            <ul className="participant-list">
              {sortedParticipants.map((participant) => (
                <li key={participant.id}>
                  <span className="participant-avatar" aria-hidden="true">
                    {participant.name.slice(0, 1)}
                  </span>
                  <strong>{participant.name}</strong>
                  {participant.id === recruitment.managerId && (
                    <em>모집 관리자</em>
                  )}
                  {participant.id === currentUser?.id && <small>나</small>}
                </li>
              ))}
            </ul>
          ) : (
            <div className="private-info-panel">
              <strong>참여자 정보는 참여 후 확인할 수 있어요.</strong>
              <p>공개 현황판과 참여 전 상세에서는 참여 인원수만 표시합니다.</p>
            </div>
          )}
        </section>

        {isManager && isOpen && (
          <section className="detail-section manager-section">
            <span className="section-label">MANAGE</span>
            <h2>모집 관리</h2>
            <p>
              참여를 취소하면 남은 사람 중 가장 먼저 참여한 사람에게 관리자
              역할이 자동으로 넘어갑니다.
            </p>
            <button type="button" onClick={handleCancelRecruitment}>
              모집 전체 취소
            </button>
          </section>
        )}

        <section className="handoff-panel" aria-label="Slack 인계 상태">
          <div>
            <span className="section-label">NEXT</span>
            <strong>
              {recruitment.status === "handoff-complete"
                ? "Slack 인계가 완료됐어요."
                : "모집 마감 후 Slack에서 대화를 이어가요."}
            </strong>
          </div>
          <p>구체적인 Slack 연결 방식은 권한 확인 후 결정할 예정입니다.</p>
        </section>
      </article>
    </main>
  );
}
