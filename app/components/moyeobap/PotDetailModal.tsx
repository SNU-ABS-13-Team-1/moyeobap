import type { Pot, Restaurant, User } from '../../types/moyeobap';
import { estimateNeededParticipants, getTimeRemaining, formatTime } from '../../lib/moyeobap-utils';
import { ChatPanel } from './ChatPanel';
import { Modal } from './Modal';

interface PotDetailModalProps {
  pot: Pot;
  restaurant: Restaurant;
  isAuthenticated: boolean;
  currentUser: User | null;
  now: number;
  onClose: () => void;
  onJoin: (potId: string) => void;
  onLeave: (potId: string) => void;
  onOpenAuth: () => void;
}

export function PotDetailModal({
  pot,
  restaurant,
  isAuthenticated,
  currentUser,
  now,
  onClose,
  onJoin,
  onLeave,
  onOpenAuth,
}: PotDetailModalProps) {
  const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline, now);
  const timeStr = pot.status === 'closed' ? '00:00' : formatTime(minutes, seconds);
  const isParticipating = pot.isParticipating;
  const neededForMinOrder = estimateNeededParticipants(restaurant.minOrder, restaurant.menus[0]?.price);

  const footer = pot.status === 'closed' ? (
    <button className="create__submit-btn" disabled type="button">마감된 팟입니다</button>
  ) : !isAuthenticated ? (
    <button className="create__submit-btn" onClick={() => { onClose(); onOpenAuth(); }} type="button">
      로그인하고 참여하기
    </button>
  ) : isParticipating ? (
    <button
      className="create__submit-btn create__submit-btn--danger"
      onClick={() => onLeave(pot.id)}
      type="button"
    >
      탑승 취소하기
    </button>
  ) : (
    <button className="create__submit-btn" onClick={() => onJoin(pot.id)} type="button">탑승하기 🚀</button>
  );

  return (
    <Modal footer={footer} onClose={onClose} title="팟 상세">
          <div className="detail__restaurant">
            <div className="detail__emoji">{restaurant.emoji}</div>
            <div className="detail__name">{restaurant.name}</div>
            <span className={`card__category detail__category ${restaurant.category === 'lunch' ? 'card__category--lunch' : 'card__category--cafe'}`}>
              {restaurant.category === 'lunch' ? '점심' : '카페'}
            </span>
          </div>

          <div className="detail__timer-section">
            <div className={`detail__timer ${isUrgent && pot.status !== 'closed' ? 'card__timer--urgent' : ''}`}>{timeStr}</div>
            <div className="detail__timer-label">마감까지 남은 시간</div>
          </div>

          <div className="detail__info-grid">
            <div className="detail__info-item">
              <span className="detail__info-label">최소주문금액</span>
              <span className="detail__info-value">{restaurant.minOrder.toLocaleString()}원</span>
            </div>
            <div className="detail__info-item">
              <span className="detail__info-label">예상 배달시간</span>
              <span className="detail__info-value">{restaurant.deliveryTime}</span>
            </div>
            <div className="detail__info-item">
              <span className="detail__info-label">참여인원</span>
              <span className="detail__info-value">
                {pot.participantCount}명{pot.maxParticipants ? ` / ${pot.maxParticipants}명` : ''}
              </span>
            </div>
            <div className="detail__info-item">
              <span className="detail__info-label">상태</span>
              <span className="detail__info-value">
                {pot.status === 'closed' ? '마감' : (isUrgent ? '⚠️ 마감임박' : '✅ 모집중')}
              </span>
            </div>
          </div>

          {neededForMinOrder !== null && pot.status !== 'closed' && (
            <p className="detail__feasibility">
              {pot.participantCount >= neededForMinOrder
                ? `✅ 대표메뉴 기준으로 최소주문금액을 채울 수 있어요.`
                : `대표메뉴 1개씩 주문한다고 하면 최소 ${neededForMinOrder}명이면 최소주문금액을 채울 수 있을 것으로 보여요 (현재 ${pot.participantCount}명).`}
            </p>
          )}

          <div className="detail__menu-section">
            <h4 className="detail__section-title">📋 대표 메뉴</h4>
            <div className="detail__menu-list">
              {restaurant.menus.length === 0 && (
                <div className="detail__participant-hidden">대표 메뉴 정보가 아직 없어요.</div>
              )}
              {restaurant.menus.map((menu) => (
                <div key={`${menu.name}-${menu.price}`} className="detail__menu-item">
                  <span className="detail__menu-name">{menu.name}</span>
                  <span className="detail__menu-price">{menu.price}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail__participants-section">
            <h4 className="detail__section-title">👥 참여자 ({pot.participantCount}명)</h4>
            {!isAuthenticated ? (
              <div className="detail__participant-hidden">🔒 로그인하면 참여자 정보를 확인할 수 있어요</div>
            ) : isParticipating && pot.participants ? (
              pot.participants.map((participant, index) => (
                <div key={`${participant.name}-${index}`} className="detail__participant">
                  <div className="detail__participant-avatar">{participant.initial}</div>
                  <span className="detail__participant-name">{participant.name}</span>
                  {participant.isManager && <span className="detail__participant-badge">👑 관리자</span>}
                </div>
              ))
            ) : (
              <div className="detail__participant-hidden">현재 {pot.participantCount}명이 참여하고 있어요! 👀</div>
            )}
          </div>

          {isParticipating && currentUser && (
            <div className="detail__chat-section">
              <h4 className="detail__section-title">💬 팟 채팅</h4>
              <ChatPanel potId={pot.id} currentUser={currentUser} />
            </div>
          )}

    </Modal>
  );
}
