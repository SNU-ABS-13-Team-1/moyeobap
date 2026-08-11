import React from 'react';
import { Pot, Restaurant, User } from '../../types/moyeobap';
import { getTimeRemaining, formatTime } from '../../lib/moyeobap-utils';

interface PotCardProps {
  pot: Pot;
  restaurant: Restaurant;
  isAuthenticated: boolean;
  currentUser: User | null;
  index: number;
  onCardClick: (potId: string) => void;
  onJoinClick: (potId: string) => void;
  onOpenAuth: () => void;
}

export const PotCard: React.FC<PotCardProps> = ({
  pot,
  restaurant,
  isAuthenticated,
  currentUser,
  index,
  onCardClick,
  onJoinClick,
  onOpenAuth,
}) => {
  const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline);
  const timeStr = pot.status === 'closed' ? '00:00' : formatTime(minutes, seconds);
  const isClosed = pot.status === 'closed';
  const isParticipating = isAuthenticated && currentUser && pot.participants.some(p => p.id === currentUser.id);

  let cardClasses = 'card';
  if (isUrgent && !isClosed) cardClasses += ' card--urgent';
  if (isClosed) cardClasses += ' card--closed';
  if (isParticipating && !isClosed) cardClasses += ' card--mine';

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

  const showCount = Math.min(3, pot.participants.length);

  return (
    <article
      className={cardClasses}
      style={{ animationDelay: `${index * 80}ms` }}
      onClick={() => onCardClick(pot.id)}
    >
      <div className="card__header">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className={`card__category ${catClass}`}>{catLabel}</span>
          <span className={`card__status ${statusClass}`}>{statusText}</span>
        </div>
        <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{restaurant.emoji}</span>
      </div>
      <h3 className="card__name">{restaurant.name}</h3>
      <p className="card__meta">최소주문 {restaurant.minOrder.toLocaleString()}원 · {restaurant.deliveryTime}</p>
      
      <div className="card__timer-row">
        <span className="card__timer-icon">⏱</span>
        <span>마감까지</span>
        <span className={`card__timer ${isUrgent && !isClosed ? 'card__timer--urgent' : ''}`}>{timeStr}</span>
      </div>

      <div className="card__footer">
        <div className="card__participants">
          <div className="card__avatars">
            {pot.participants.slice(0, showCount).map(p => (
              <div key={p.id} className="card__avatar">{p.initial}</div>
            ))}
            {pot.participants.length > 3 && (
              <div className="card__avatar card__avatar--more">+{pot.participants.length - 3}</div>
            )}
          </div>
          <span className="card__count">
            <span>{pot.participants.length}</span>명 참여{pot.maxParticipants ? ` / ${pot.maxParticipants}명` : ''}
          </span>
        </div>

        <button
          className={`card__join-btn ${
            isClosed
              ? 'card__join-btn--closed'
              : !isAuthenticated
              ? 'card__join-btn--login'
              : isParticipating
              ? 'card__join-btn--joined'
              : 'card__join-btn--join'
          }`}
          onClick={(e) => {
            e.stopPropagation();
            if (isClosed) return;
            if (!isAuthenticated) onOpenAuth();
            else if (isParticipating) {
              onCardClick(pot.id);
            } else {
              onJoinClick(pot.id);
            }
          }}
        >
          {isClosed ? '마감' : !isAuthenticated ? '로그인 후 참여' : isParticipating ? '탑승중 ✓' : '탑승하기'}
        </button>
      </div>
    </article>
  );
};
