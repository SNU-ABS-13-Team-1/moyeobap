import Link from 'next/link';
import type { Pot, Restaurant } from '../../types/moyeobap';
import { getTimeRemaining, formatTime } from '../../lib/moyeobap-utils';

interface PotCardProps {
  pot: Pot;
  restaurant: Restaurant;
  isAuthenticated: boolean;
  now: number;
  onJoinClick: (potId: string) => void;
  onOpenAuth: (potId: string) => void;
  showChatSummary?: boolean;
}

export function PotCard({
  pot,
  restaurant,
  isAuthenticated,
  now,
  onJoinClick,
  onOpenAuth,
  showChatSummary = false,
}: PotCardProps) {
  const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline, now);
  const isClosed = pot.status === 'closed';
  const isParticipating = pot.isParticipating;
  const timeStr = formatTime(minutes, seconds);
  const closedAt = `${pot.deadline.getMonth() + 1}/${pot.deadline.getDate()} ${String(pot.deadline.getHours()).padStart(2, '0')}:${String(pot.deadline.getMinutes()).padStart(2, '0')}`;
  const restaurantMeta = [
    restaurant.minOrder > 0 ? `최소주문 ${restaurant.minOrder.toLocaleString()}원` : null,
    restaurant.deliveryTime !== '정보 없음' ? restaurant.deliveryTime : null,
  ].filter(Boolean).join(' · ') || '매장 상세 정보 없음';

  let cardClasses = 'card';
  if (isUrgent && !isClosed) cardClasses += ' card--urgent';
  // 비참여자도 마감된 팟의 기본 정보는 열어볼 수 있습니다.
  if (isClosed && !isParticipating) cardClasses += ' card--closed';
  if (isParticipating) cardClasses += ' card--mine';

  const effectiveCategory = pot.category ?? restaurant.category;
  const catLabel = effectiveCategory === 'lunch' ? '점심' : effectiveCategory === 'other' ? '기타' : '카페';
  const catClass = effectiveCategory === 'lunch' ? 'card__category--lunch' : effectiveCategory === 'other' ? 'card__category--other' : 'card__category--cafe';

  let statusClass = 'card__status--open';
  let statusText = '모집 중';
  if (isClosed) {
    statusClass = pot.orderCompletedAt ? 'card__status--completed' : 'card__status--closed';
    statusText = pot.orderCompletedAt ? '주문 완료' : '마감';
  } else if (isUrgent) {
    statusClass = 'card__status--urgent';
    statusText = '마감 임박';
  }

  return (
    <article className={cardClasses}>
      <Link className="card__details" href={`/pots/${encodeURIComponent(pot.id)}`}>
        <div className="card__header">
          <div className="card__badges">
            <span className={`card__category ${catClass}`}>{catLabel}</span>
            <span className={`card__status ${statusClass}`}>{statusText}</span>
            {showChatSummary && pot.unreadMessageCount > 0 && (
              <span
                aria-label={`읽지 않은 메시지 ${pot.unreadMessageCount}개`}
                className="card__unread-badge"
              >
                {pot.unreadMessageCount > 99 ? '99+' : pot.unreadMessageCount}
              </span>
            )}
          </div>
          <span className="card__emoji">{restaurant.emoji}</span>
        </div>
        <h3 className="card__name">{restaurant.name}</h3>
        <p className="card__meta">{restaurantMeta}</p>

        {showChatSummary && (
          <div className={`card__chat-preview ${pot.unreadMessageCount > 0 ? 'card__chat-preview--unread' : ''}`}>
            <span>
              {pot.latestMessage
                ? `${pot.latestMessage.authorName}: ${pot.latestMessage.text}`
                : '아직 새 메시지가 없어요.'}
            </span>
            {pot.latestMessage && (
              <time dateTime={pot.latestMessage.createdAt}>
                {new Intl.DateTimeFormat('ko-KR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }).format(new Date(pot.latestMessage.createdAt))}
              </time>
            )}
          </div>
        )}

        <div className="card__timer-row">
          {isClosed ? (
            <span className="card__timer">{closedAt} 마감</span>
          ) : (
            <>
              <span>마감까지</span>
              <span className={`card__timer ${isUrgent ? 'card__timer--urgent' : ''}`}>{timeStr}</span>
            </>
          )}
        </div>
      </Link>

      <div className="card__footer">
        <div className="card__participants">
          <span className="card__count">
            <span>{pot.participantCount}</span>명 참여{pot.maxParticipants ? ` / ${pot.maxParticipants}명` : ''}
          </span>
        </div>

        {isParticipating ? (
          <Link
            className="card__join-btn card__join-btn--joined"
            href={`/pots/${encodeURIComponent(pot.id)}`}
          >
            {isClosed ? '채팅 보기' : '참여 중'}
          </Link>
        ) : isClosed ? (
          <Link
            className="card__join-btn card__join-btn--closed"
            href={`/pots/${encodeURIComponent(pot.id)}`}
          >
            정보 보기
          </Link>
        ) : (
          <button
            className={`card__join-btn ${
              !isAuthenticated
                ? 'card__join-btn--login'
                : 'card__join-btn--join'
            }`}
            type="button"
            onClick={() => {
              if (!isAuthenticated) onOpenAuth(pot.id);
              else onJoinClick(pot.id);
            }}
          >
            {!isAuthenticated ? '로그인 후 참여' : '참여하기'}
          </button>
        )}
      </div>
    </article>
  );
}
