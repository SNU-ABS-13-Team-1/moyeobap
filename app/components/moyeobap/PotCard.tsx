import Link from 'next/link';
import type { Pot, Restaurant } from '../../types/moyeobap';
import { getTimeRemaining, formatTime } from '../../lib/moyeobap-utils';

interface PotCardProps {
  pot: Pot;
  restaurant: Restaurant;
  isAuthenticated: boolean;
  now: number;
  index: number;
  onJoinClick: (potId: string) => void;
  onOpenAuth: (potId: string) => void;
}

export function PotCard({
  pot,
  restaurant,
  isAuthenticated,
  now,
  index,
  onJoinClick,
  onOpenAuth,
}: PotCardProps) {
  const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline, now);
  const timeStr = pot.status === 'closed' ? '00:00' : formatTime(minutes, seconds);
  const isClosed = pot.status === 'closed';
  const isParticipating = pot.isParticipating;

  let cardClasses = 'card';
  if (isUrgent && !isClosed) cardClasses += ' card--urgent';
  // 마감된 방은 카드 전체가 pointer-events: none이라 참여자도 못 들어가서 채팅을 못 치는
  // 문제가 있었습니다. 참여 중인 사람에게는 이 비활성 스타일을 주지 않습니다.
  if (isClosed && !isParticipating) cardClasses += ' card--closed';
  if (isParticipating) cardClasses += ' card--mine';

  const catLabel = restaurant.category === 'lunch' ? '점심' : '카페';
  const catClass = restaurant.category === 'lunch' ? 'card__category--lunch' : 'card__category--cafe';

  let statusClass = 'card__status--open';
  let statusText = '모집중';
  if (isClosed) {
    statusClass = 'card__status--closed';
    statusText = '마감';
  } else if (isUrgent) {
    statusClass = 'card__status--urgent';
    statusText = '마감임박';
  }

  return (
    <article
      className={cardClasses}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <Link className="card__details" href={`/pots/${encodeURIComponent(pot.id)}`}>
        <div className="card__header">
          <div className="card__badges">
            <span className={`card__category ${catClass}`}>{catLabel}</span>
            <span className={`card__status ${statusClass}`}>{statusText}</span>
          </div>
          <span className="card__emoji">{restaurant.emoji}</span>
        </div>
        <h3 className="card__name">{restaurant.name}</h3>
        <p className="card__meta">최소주문 {restaurant.minOrder.toLocaleString()}원 · {restaurant.deliveryTime}</p>

        <div className="card__timer-row">
          <span className="card__timer-icon">⏱</span>
          <span>마감까지</span>
          <span className={`card__timer ${isUrgent && !isClosed ? 'card__timer--urgent' : ''}`}>{timeStr}</span>
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
            탑승중 ✓
          </Link>
        ) : (
          <button
            className={`card__join-btn ${
              isClosed
                ? 'card__join-btn--closed'
                : !isAuthenticated
                ? 'card__join-btn--login'
                : 'card__join-btn--join'
            }`}
            disabled={isClosed}
            type="button"
            onClick={() => {
              if (!isAuthenticated) onOpenAuth(pot.id);
              else onJoinClick(pot.id);
            }}
          >
            {isClosed ? '마감' : !isAuthenticated ? '로그인 후 참여' : '탑승하기'}
          </button>
        )}
      </div>
    </article>
  );
}
