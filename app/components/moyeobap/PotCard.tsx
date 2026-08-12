import type { Pot, Restaurant } from '../../types/moyeobap';
import { getTimeRemaining, formatTime } from '../../lib/moyeobap-utils';

interface PotCardProps {
  pot: Pot;
  restaurant: Restaurant;
  isAuthenticated: boolean;
  now: number;
  index: number;
  onCardClick: (potId: string) => void;
  onJoinClick: (potId: string) => void;
  onOpenAuth: () => void;
}

export function PotCard({
  pot,
  restaurant,
  isAuthenticated,
  now,
  index,
  onCardClick,
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
      <button className="card__details" onClick={() => onCardClick(pot.id)} type="button">
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
      </button>

      <div className="card__footer">
        <div className="card__participants">
          <span className="card__count">
            <span>{pot.participantCount}</span>명 참여{pot.maxParticipants ? ` / ${pot.maxParticipants}명` : ''}
          </span>
        </div>

        <button
          className={`card__join-btn ${
            isParticipating
              ? 'card__join-btn--joined'
              : isClosed
              ? 'card__join-btn--closed'
              : !isAuthenticated
              ? 'card__join-btn--login'
              : 'card__join-btn--join'
          }`}
          type="button"
          onClick={() => {
            // 마감된 방이어도 이미 참여 중인 사람은 계속 들어가서 채팅할 수 있어야 해서,
            // 마감 여부보다 참여 여부를 먼저 확인합니다.
            if (isParticipating) {
              onCardClick(pot.id);
              return;
            }
            if (isClosed) return;
            if (!isAuthenticated) onOpenAuth();
            else onJoinClick(pot.id);
          }}
        >
          {isParticipating ? '탑승중 ✓' : isClosed ? '마감' : !isAuthenticated ? '로그인 후 참여' : '탑승하기'}
        </button>
      </div>
    </article>
  );
}
