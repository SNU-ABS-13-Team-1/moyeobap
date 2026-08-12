import React from 'react';
import { Pot, Restaurant, User } from '../../types/moyeobap';
import { estimateNeededParticipants, getTimeRemaining, formatTime } from '../../lib/moyeobap-utils';
import { ChatPanel } from './ChatPanel';

interface PotDetailModalProps {
  pot: Pot;
  restaurant: Restaurant;
  isAuthenticated: boolean;
  currentUser: User | null;
  onClose: () => void;
  onJoin: (potId: string) => void;
  onLeave: (potId: string) => void;
  onOpenAuth: () => void;
}

export const PotDetailModal: React.FC<PotDetailModalProps> = ({
  pot,
  restaurant,
  isAuthenticated,
  currentUser,
  onClose,
  onJoin,
  onLeave,
  onOpenAuth,
}) => {
  const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline);
  const timeStr = pot.status === 'closed' ? '00:00' : formatTime(minutes, seconds);
  const isParticipating = isAuthenticated && currentUser && pot.participants.some(p => p.id === currentUser.id);
  const neededForMinOrder = estimateNeededParticipants(restaurant.minOrder, restaurant.menus[0]?.price);

  return (
    <div className="modal-overlay modal-overlay--active" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">팟 상세</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
          <div className="detail__restaurant">
            <div className="detail__emoji">{restaurant.emoji}</div>
            <div className="detail__name">{restaurant.name}</div>
            <span className={`card__category ${restaurant.category === 'lunch' ? 'card__category--lunch' : 'card__category--cafe'}`} style={{ display: 'inline-block' }}>
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
              {restaurant.menus.map((m, idx) => (
                <div key={idx} className="detail__menu-item">
                  <span className="detail__menu-name">{m.name}</span>
                  <span className="detail__menu-price">{m.price}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail__participants-section">
            <h4 className="detail__section-title">👥 참여자 ({pot.participantCount}명)</h4>
            {!isAuthenticated ? (
              <div className="detail__participant-hidden">🔒 로그인하면 참여자 정보를 확인할 수 있어요</div>
            ) : isParticipating ? (
              pot.participants.map((p, i) => (
                <div key={p.id} className="detail__participant">
                  <div className="detail__participant-avatar">{p.initial}</div>
                  <span className="detail__participant-name">{p.name}</span>
                  {i === 0 && <span className="detail__participant-badge">👑 방장</span>}
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

          <div className="modal__footer" style={{ padding: 0 }}>
            {pot.status === 'closed' ? (
              <button className="create__submit-btn" disabled style={{ opacity: 0.4 }}>마감된 팟입니다</button>
            ) : !isAuthenticated ? (
              <button className="create__submit-btn" onClick={() => { onClose(); onOpenAuth(); }}>로그인하고 참여하기</button>
            ) : isParticipating ? (
              <button
                className="create__submit-btn"
                style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                onClick={() => onLeave(pot.id)}
              >
                탑승 취소하기
              </button>
            ) : (
              <button className="create__submit-btn" onClick={() => onJoin(pot.id)}>탑승하기 🚀</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
