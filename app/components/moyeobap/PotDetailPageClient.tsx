'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import type { Pot, Restaurant, SerializedPot } from '../../types/moyeobap';
import { estimateNeededParticipants, formatTime, getTimeRemaining, triggerConfetti } from '../../lib/moyeobap-utils';
import { fetcher } from '../../lib/fetcher';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { useClock } from '../../hooks/useClock';
import { useToastNotice } from '../../hooks/useToastNotice';
import { useAuth } from './AuthProvider';
import { ChatPanel } from './ChatPanel';
import { ToastNotice } from './ToastNotice';

interface PotDetailResponse {
  pot: SerializedPot;
  restaurant: Restaurant;
}

function toPot(pot: SerializedPot): Pot {
  return { ...pot, deadline: new Date(pot.deadline) };
}

export function PotDetailPageClient({ potId }: { potId: string }) {
  const router = useRouter();
  const { mutate: mutateCache } = useSWRConfig();
  const { currentUser, openAuth } = useAuth();
  const { toast, showToast } = useToastNotice();
  const [mobileTab, setMobileTab] = useState<'info' | 'chat'>('info');
  const now = useClock();
  const { data, error, mutate } = useSWR<PotDetailResponse>(
    `/api/pots/${encodeURIComponent(potId)}`,
    fetcher,
    { refreshInterval: 4000 },
  );

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') router.push('/');
    }
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [router]);

  if (error) {
    return (
      <main className="page-content">
        <div className="page-state page-state--error">
          <span>⚠️</span>
          <h1>팟을 불러오지 못했어요</h1>
          <p>{getErrorMessage(error, '존재하지 않거나 종료된 팟일 수 있어요.')}</p>
          <Link className="page-back-link" href="/">현황판으로 돌아가기</Link>
        </div>
      </main>
    );
  }
  if (!data) {
    return <main className="page-content"><div className="page-state">팟 정보를 불러오는 중이에요...</div></main>;
  }

  const pot = toPot(data.pot);
  const restaurant = data.restaurant;
  const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline, now);
  const timeText = pot.status === 'closed' ? '00:00' : formatTime(minutes, seconds);
  const neededForMinOrder = estimateNeededParticipants(restaurant.minOrder, restaurant.menus[0]?.price);

  async function handleJoin() {
    if (!currentUser) {
      openAuth(`/pots/${encodeURIComponent(potId)}`);
      return;
    }
    try {
      await requestJson(`/api/pots/${potId}/join`, { method: 'POST' });
      await Promise.all([mutate(), mutateCache('/api/pots')]);
      showToast(`${restaurant.name}에 탑승했어요! 🚀`, 'success');
      triggerConfetti();
    } catch (joinError) {
      showToast(getErrorMessage(joinError, '참여하지 못했어요.'), 'error');
    }
  }

  async function handleLeave() {
    try {
      const response = await requestJson<{ pot: SerializedPot }>(`/api/pots/${potId}/leave`, {
        method: 'POST',
      });
      await mutateCache('/api/pots');
      if (response.pot.participantCount === 0) {
        router.push('/');
        return;
      }
      await mutate();
      showToast('팟 탑승을 취소했어요.', 'warning');
    } catch (leaveError) {
      showToast(getErrorMessage(leaveError, '참여 취소에 실패했어요.'), 'error');
    }
  }

  let action: React.ReactNode;
  if (pot.status === 'closed') {
    action = <button className="create__submit-btn" disabled type="button">마감된 팟입니다</button>;
  } else if (!currentUser) {
    action = <button className="create__submit-btn" onClick={handleJoin} type="button">로그인하고 참여하기</button>;
  } else if (pot.isParticipating) {
    action = (
      <button className="create__submit-btn create__submit-btn--danger" onClick={handleLeave} type="button">
        탑승 취소하기
      </button>
    );
  } else {
    action = <button className="create__submit-btn" onClick={handleJoin} type="button">탑승하기 🚀</button>;
  }

  return (
    <main className="page-content pot-page">
      <div className="page-heading page-heading--compact">
        <Link className="page-back-link" href="/">← 현황판으로</Link>
        <span className="page-heading__shortcut">Esc로 현황판 이동</span>
      </div>

      <div className="pot-page__mobile-tabs" role="tablist" aria-label="팟 상세 영역">
        <button aria-selected={mobileTab === 'info'} onClick={() => setMobileTab('info')} role="tab" type="button">모집 정보</button>
        <button aria-selected={mobileTab === 'chat'} onClick={() => setMobileTab('chat')} role="tab" type="button">채팅</button>
      </div>

      <div className="pot-page__layout">
        <section className={`pot-page__info ${mobileTab === 'info' ? 'pot-page__panel--mobile-active' : ''}`}>
          <div className="pot-page__hero">
            <div className="detail__emoji">{restaurant.emoji}</div>
            <div>
              <div className="card__badges">
                <span className={`card__category ${restaurant.category === 'lunch' ? 'card__category--lunch' : 'card__category--cafe'}`}>
                  {restaurant.category === 'lunch' ? '점심' : '카페'}
                </span>
                {pot.isManaging && <span className="detail__participant-badge">👑 내가 관리 중</span>}
              </div>
              <h1>{restaurant.name}</h1>
              <p>{restaurant.address ?? '매장 주소 정보가 아직 없어요.'}</p>
            </div>
          </div>

          <div className="detail__timer-section">
            <div className={`detail__timer ${isUrgent && pot.status !== 'closed' ? 'card__timer--urgent' : ''}`}>{timeText}</div>
            <div className="detail__timer-label">{pot.status === 'closed' ? '모집이 마감됐어요' : '마감까지 남은 시간'}</div>
          </div>

          <div className="detail__info-grid">
            <div className="detail__info-item"><span className="detail__info-label">최소주문금액</span><span className="detail__info-value">{restaurant.minOrder.toLocaleString()}원</span></div>
            <div className="detail__info-item"><span className="detail__info-label">예상 배달시간</span><span className="detail__info-value">{restaurant.deliveryTime}</span></div>
            <div className="detail__info-item"><span className="detail__info-label">참여인원</span><span className="detail__info-value">{pot.participantCount}명{pot.maxParticipants ? ` / ${pot.maxParticipants}명` : ''}</span></div>
            <div className="detail__info-item"><span className="detail__info-label">상태</span><span className="detail__info-value">{pot.status === 'closed' ? '마감' : isUrgent ? '⚠️ 마감임박' : '✅ 모집중'}</span></div>
          </div>

          {neededForMinOrder !== null && pot.status !== 'closed' && (
            <p className="detail__feasibility">
              {pot.participantCount >= neededForMinOrder
                ? '✅ 대표메뉴 기준으로 최소주문금액을 채울 수 있어요.'
                : `대표메뉴 1개씩 주문한다면 최소 ${neededForMinOrder}명이 필요해 보여요. 현재 ${pot.participantCount}명이에요.`}
            </p>
          )}

          <div className="detail__menu-section">
            <h2 className="detail__section-title">📋 대표 메뉴</h2>
            <div className="detail__menu-list">
              {restaurant.menus.length === 0 && <div className="detail__participant-hidden">대표 메뉴 정보가 아직 없어요.</div>}
              {restaurant.menus.map((menu) => (
                <div className="detail__menu-item" key={`${menu.name}-${menu.price}`}>
                  <span className="detail__menu-name">{menu.name}</span>
                  <span className="detail__menu-price">{menu.price}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail__participants-section">
            <h2 className="detail__section-title">👥 참여자 ({pot.participantCount}명)</h2>
            {!currentUser ? (
              <div className="detail__participant-hidden">🔒 로그인 후 참여하면 참여자를 확인할 수 있어요.</div>
            ) : pot.isParticipating && pot.participants ? (
              pot.participants.map((participant, index) => (
                <div className="detail__participant" key={`${participant.name}-${index}`}>
                  <div className="detail__participant-avatar">{participant.initial}</div>
                  <span className="detail__participant-name">{participant.name}</span>
                  {participant.isManager && <span className="detail__participant-badge">👑 관리자</span>}
                </div>
              ))
            ) : (
              <div className="detail__participant-hidden">참여 후에 참여자 정보를 확인할 수 있어요.</div>
            )}
          </div>

          <div className="pot-page__action">{action}</div>
        </section>

        <aside className={`pot-page__chat ${mobileTab === 'chat' ? 'pot-page__panel--mobile-active' : ''}`}>
          <div className="pot-page__chat-header">
            <div><span>팟 채팅</span><p>{restaurant.name}</p></div>
            <Link href="/my">내 채팅방 보기 →</Link>
          </div>
          {pot.isParticipating && currentUser ? (
            <ChatPanel currentUser={currentUser} potId={pot.id} />
          ) : (
            <div className="pot-page__chat-locked">
              <span>💬</span>
              <strong>참여자 전용 채팅이에요</strong>
              <p>팟에 참여하면 주문과 정산 이야기를 나눌 수 있어요.</p>
              {pot.status === 'active' && <button onClick={handleJoin} type="button">{currentUser ? '팟 참여하기' : '로그인하고 참여하기'}</button>}
            </div>
          )}
        </aside>
      </div>
      <ToastNotice toast={toast} />
    </main>
  );
}
