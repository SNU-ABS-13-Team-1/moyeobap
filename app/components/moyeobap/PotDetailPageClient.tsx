'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import type { ParticipantProfile, Pot, Restaurant, SerializedPot } from '../../types/moyeobap';
import { estimateNeededParticipants, formatTime, getTimeRemaining } from '../../lib/moyeobap-utils';
import { fetcher } from '../../lib/fetcher';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { useClock } from '../../hooks/useClock';
import { useToastNotice } from '../../hooks/useToastNotice';
import { useAuth } from './AuthProvider';
import { ChatPanel } from './ChatPanel';
import { ToastNotice } from './ToastNotice';
import { StoreReportModal } from './StoreReportModal';

interface PotDetailResponse {
  pot: SerializedPot;
  restaurant: Restaurant;
}

function toPot(pot: SerializedPot): Pot {
  return { ...pot, deadline: new Date(pot.deadline) };
}

function toLocalDateTimeValue(value: Date | number) {
  const date = new Date(value);
  const localTime = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localTime.toISOString().slice(0, 16);
}

function ceilToMinute(timestamp: number) {
  return Math.ceil(timestamp / 60_000) * 60_000;
}

export function PotDetailPageClient({ potId }: { potId: string }) {
  const router = useRouter();
  const { mutate: mutateCache } = useSWRConfig();
  const { currentUser, openAuth } = useAuth();
  const { toast, showToast } = useToastNotice();
  const [mobileTab, setMobileTab] = useState<'info' | 'chat'>('info');
  const [deadlineEdit, setDeadlineEdit] = useState<{ source: string; value: string } | null>(null);
  const [isManagingDeadline, setIsManagingDeadline] = useState(false);
  const [isTogglingPaid, setIsTogglingPaid] = useState(false);
  const [isDeletingPot, setIsDeletingPot] = useState(false);
  const [memoEdit, setMemoEdit] = useState<string | null>(null);
  const [isSavingMemo, setIsSavingMemo] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const now = useClock();
  const { data, error, mutate } = useSWR<PotDetailResponse>(
    `/api/pots/${encodeURIComponent(potId)}`,
    fetcher,
    {
      refreshInterval: 10000,
      refreshWhenHidden: false,
      revalidateOnFocus: true,
      dedupingInterval: 2000,
    },
  );

  // Supabase Realtime 구독 (참여자 변경, 송금 상태, 팟 상태 실시간 동기화)
  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return;
    }

    const channel = supabase
      .channel(`pot-detail-${potId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pot_participants',
          filter: `pot_id=eq.${potId}`,
        },
        () => {
          mutate();
          mutateCache('/api/pots');
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pots',
          filter: `id=eq.${potId}`,
        },
        () => {
          mutate();
          mutateCache('/api/pots');
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [potId, mutate, mutateCache]);

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
  const deadlineDraft = deadlineEdit?.source === data.pot.deadline
    ? deadlineEdit.value
    : toLocalDateTimeValue(pot.deadline);
  const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline, now);
  const deadlineText = new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(pot.deadline);
  const timeText = pot.status === 'closed' ? '마감' : formatTime(minutes, seconds);
  const minDeadlineValue = toLocalDateTimeValue(ceilToMinute(now + 5 * 60_000 + 1_000));
  const maxDeadlineValue = toLocalDateTimeValue(now + 24 * 60 * 60_000);
  const deadlineDraftTime = new Date(deadlineDraft).getTime();
  const canUpdateDeadline = Number.isFinite(deadlineDraftTime)
    && deadlineDraftTime >= now + 5 * 60_000
    && deadlineDraftTime <= now + 24 * 60 * 60_000;
  const neededForMinOrder = estimateNeededParticipants(restaurant.minOrder, restaurant.menus[0]?.price);

  const myParticipant = pot.participants?.find((p) => p.isMe);

  async function handleTogglePaid(targetParticipant: ParticipantProfile, targetIndex: number) {
    if (isTogglingPaid) return;

    const currentIsPaid = Boolean(targetParticipant.isPaid);
    const nextIsPaid = !currentIsPaid;
    const isTargetMe = targetParticipant.isMe;

    // 1. 낙관적 UI 업데이트 (0ms 즉시 화면 반영)
    mutate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pot: {
          ...prev.pot,
          participants: prev.pot.participants
            ? prev.pot.participants.map((p, idx) => (idx === targetIndex ? { ...p, isPaid: nextIsPaid } : p))
            : null,
        },
      };
    }, false);

    const toastMessage = isTargetMe
      ? nextIsPaid
        ? '송금 완료 상태로 표시했어요.'
        : '송금 완료 표시를 해제했어요.'
      : nextIsPaid
        ? `${targetParticipant.name}님을 송금 완료 처리했어요.`
        : `${targetParticipant.name}님의 송금 완료 표시를 해제했어요.`;

    showToast(toastMessage, 'success');

    setIsTogglingPaid(true);
    try {
      const response = await requestJson<{ pot: SerializedPot }>(`/api/pots/${potId}/paid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetIndex }),
      });
      await Promise.all([
        mutate((prev) => (prev ? { ...prev, pot: response.pot } : prev), false),
        mutateCache('/api/pots'),
      ]);
    } catch (toggleErr) {
      await mutate();
      showToast(getErrorMessage(toggleErr, '송금 상태를 변경하지 못했어요.'), 'error');
    } finally {
      setIsTogglingPaid(false);
    }
  }

  async function handleSaveMemo(memoText: string) {
    const trimmedMemo = memoText.trim().slice(0, 100);
    setMemoEdit(null);

    // 1. 낙관적 UI 업데이트 (0ms 즉시 화면 반영)
    mutate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pot: {
          ...prev.pot,
          participants: prev.pot.participants
            ? prev.pot.participants.map((p) =>
                p.isMe ? { ...p, orderMemo: trimmedMemo || undefined } : p,
              )
            : null,
        },
      };
    }, false);

    showToast('주문 메모를 저장했어요.', 'success');

    setIsSavingMemo(true);
    try {
      const response = await requestJson<{ pot: SerializedPot }>(`/api/pots/${potId}/memo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memo: trimmedMemo }),
      });
      await mutate((prev) => (prev ? { ...prev, pot: response.pot } : prev), false);
    } catch (err) {
      await mutate();
      showToast(getErrorMessage(err, '주문 메모를 저장하지 못했어요.'), 'error');
    } finally {
      setIsSavingMemo(false);
    }
  }

  async function handleJoin() {
    if (!currentUser) {
      openAuth(`/pots/${encodeURIComponent(potId)}`);
      return;
    }

    // 1. 낙관적 UI 업데이트 (0ms 즉시 화면 반영)
    mutate((prev) => {
      if (!prev) return prev;
      const newParticipant = {
        name: currentUser.name,
        initial: currentUser.initial,
        isManager: false,
        isMe: true,
        isPaid: false,
      };
      return {
        ...prev,
        pot: {
          ...prev.pot,
          isParticipating: true,
          participantCount: prev.pot.participantCount + 1,
          participants: prev.pot.participants ? [...prev.pot.participants, newParticipant] : [newParticipant],
        },
      };
    }, false);

    showToast(`${restaurant.name} 팟에 참여했어요.`, 'success');

    try {
      await requestJson(`/api/pots/${potId}/join`, { method: 'POST' });
      await Promise.all([mutate(), mutateCache('/api/pots')]);
    } catch (joinError) {
      await mutate();
      showToast(getErrorMessage(joinError, '참여하지 못했어요.'), 'error');
    }
  }

  async function handleLeave() {
    // 1. 낙관적 UI 업데이트
    mutate((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pot: {
          ...prev.pot,
          isParticipating: false,
          participantCount: Math.max(0, prev.pot.participantCount - 1),
          participants: prev.pot.participants
            ? prev.pot.participants.filter((p) => !p.isMe)
            : null,
        },
      };
    }, false);

    showToast('팟 참여를 취소했어요.', 'warning');

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
    } catch (leaveError) {
      await mutate();
      showToast(getErrorMessage(leaveError, '참여 취소에 실패했어요.'), 'error');
    }
  }

  async function handleDeadlineUpdate() {
    const deadline = new Date(deadlineDraft);
    if (!Number.isFinite(deadline.getTime())) {
      showToast('변경할 마감 시간을 선택해주세요.', 'error');
      return;
    }

    setIsManagingDeadline(true);
    try {
      await requestJson<{ pot: SerializedPot }>(`/api/pots/${potId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_deadline', deadline: deadline.toISOString() }),
      });
      await Promise.all([mutate(), mutateCache('/api/pots')]);
      showToast('모집 마감 시간을 변경했어요.', 'success');
    } catch (updateError) {
      showToast(getErrorMessage(updateError, '마감 시간을 변경하지 못했어요.'), 'error');
    } finally {
      setIsManagingDeadline(false);
    }
  }

  async function handleCategoryUpdate(newCategory: 'lunch' | 'cafe' | 'other') {
    setIsManagingDeadline(true);
    try {
      await requestJson<{ pot: SerializedPot }>(`/api/pots/${potId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_category', category: newCategory }),
      });
      await Promise.all([mutate(), mutateCache('/api/pots')]);
      const categoryLabel = newCategory === 'lunch' ? '점심' : newCategory === 'cafe' ? '카페' : '기타';
      showToast(`주문 종류를 '${categoryLabel}'(으)로 변경했어요.`, 'success');
    } catch (catError) {
      showToast(getErrorMessage(catError, '카테고리를 변경하지 못했어요.'), 'error');
    } finally {
      setIsManagingDeadline(false);
    }
  }

  async function handleMaxParticipantsUpdate(newCap: number | null) {
    setIsManagingDeadline(true);
    try {
      await requestJson<{ pot: SerializedPot }>(`/api/pots/${potId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update_max_participants', maxParticipants: newCap }),
      });
      await Promise.all([mutate(), mutateCache('/api/pots')]);
      showToast(newCap === null ? '인원수 제한을 해제했어요.' : `최대 인원수를 ${newCap}명으로 변경했어요.`, 'success');
    } catch (capError) {
      showToast(getErrorMessage(capError, '인원수 제한을 변경하지 못했어요.'), 'error');
    } finally {
      setIsManagingDeadline(false);
    }
  }

  async function handleCompleteOrder() {
    if (!window.confirm('실제 주문까지 완료했나요? 완료 후에는 되돌릴 수 없어요.')) return;

    setIsManagingDeadline(true);
    try {
      await requestJson<{ pot: SerializedPot }>(`/api/pots/${potId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete_order' }),
      });
      await Promise.all([mutate(), mutateCache('/api/pots')]);
      showToast('실제 주문 완료로 기록했어요.', 'success');
    } catch (completeError) {
      showToast(getErrorMessage(completeError, '주문 완료를 기록하지 못했어요.'), 'error');
    } finally {
      setIsManagingDeadline(false);
    }
  }

  async function handleDeletePot() {
    if (isDeletingPot) return;
    const confirmed = window.confirm(
      '정말 이 팟을 삭제하시겠어요?\n삭제 시 대화 내용과 참여자 기록이 모두 삭제됩니다.',
    );
    if (!confirmed) return;

    setIsDeletingPot(true);
    try {
      await requestJson(`/api/pots/${potId}`, { method: 'DELETE' });
      await mutateCache('/api/pots', undefined, { revalidate: true });
      showToast('팟을 삭제했어요.', 'success');
      router.replace('/');
    } catch (deleteError) {
      showToast(getErrorMessage(deleteError, '팟을 삭제하지 못했어요.'), 'error');
    } finally {
      setIsDeletingPot(false);
    }
  }

  async function handleCloseNow() {
    const confirmation = pot.participantCount >= 2
      ? `현재 ${pot.participantCount}명으로 지금 모집을 마감할까요? 마감 후에는 다시 열 수 없어요.`
      : '현재 참여자가 1명이라 지금 마감하면 모집 실패로 종료되고 목록에서 사라져요. 마감할까요?';
    if (!window.confirm(confirmation)) return;

    setIsManagingDeadline(true);
    try {
      const response = await requestJson<{ pot: SerializedPot }>(`/api/pots/${potId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close_now' }),
      });
      await mutateCache('/api/pots');
      if (response.pot.status === 'failed') {
        router.push('/');
        return;
      }
      await mutate();
      showToast('모집을 마감했어요.', 'success');
    } catch (closeError) {
      showToast(getErrorMessage(closeError, '모집을 마감하지 못했어요.'), 'error');
    } finally {
      setIsManagingDeadline(false);
    }
  }

  let action: React.ReactNode;
  if (pot.orderCompletedAt) {
    action = null;
  } else if (pot.status === 'closed' && pot.isManaging) {
    action = (
      <button className="create__submit-btn" disabled={isManagingDeadline} onClick={handleCompleteOrder} type="button">
        {isManagingDeadline ? '처리 중...' : '실제 주문 완료'}
      </button>
    );
  } else if (pot.status === 'closed') {
    action = null;
  } else if (!currentUser) {
    action = <button className="create__submit-btn" onClick={handleJoin} type="button">로그인하고 참여하기</button>;
  } else if (pot.isParticipating) {
    action = (
      <button className="create__submit-btn create__submit-btn--danger" onClick={handleLeave} type="button">
        참여 취소
      </button>
    );
  } else {
    action = <button className="create__submit-btn" onClick={handleJoin} type="button">참여하기</button>;
  }

  const effectiveCategory = pot.category ?? restaurant.category;

  return (
    <main className="page-content pot-page">
      <div className="page-heading page-heading--compact">
        <Link className="page-back-link" href="/">← 현황판으로</Link>
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
                <span className={`card__category ${effectiveCategory === 'lunch' ? 'card__category--lunch' : effectiveCategory === 'other' ? 'card__category--other' : 'card__category--cafe'}`}>
                  {effectiveCategory === 'lunch' ? '점심' : effectiveCategory === 'other' ? '기타' : '카페'}
                </span>
                {pot.isManaging && <span className="detail__participant-badge">👑 내가 관리 중</span>}
              </div>
              <h1>{restaurant.name}</h1>
              <p>{restaurant.address ?? '매장 주소 정보가 아직 없어요.'}</p>
            </div>
          </div>

          <div className="detail__timer-section">
            <div className={`detail__timer ${isUrgent && pot.status !== 'closed' ? 'card__timer--urgent' : ''}`}>{timeText}</div>
            <div className="detail__timer-label">{pot.status === 'closed' ? `${deadlineText}에 마감됐어요` : '마감까지 남은 시간'}</div>
          </div>

          <div className="detail__info-grid">
            <div className="detail__info-item"><span className="detail__info-label">최소주문금액</span><span className="detail__info-value">{restaurant.minOrder.toLocaleString()}원</span></div>
            <div className="detail__info-item"><span className="detail__info-label">예상 배달시간</span><span className="detail__info-value">{restaurant.deliveryTime}</span></div>
            <div className="detail__info-item"><span className="detail__info-label">참여인원</span><span className="detail__info-value">{pot.participantCount}명{pot.maxParticipants ? ` / ${pot.maxParticipants}명` : ''}</span></div>
            <div className="detail__info-item"><span className="detail__info-label">상태</span><span className="detail__info-value">{pot.orderCompletedAt ? '주문 완료' : pot.status === 'closed' ? '마감' : isUrgent ? '마감 임박' : '모집 중'}</span></div>
            {pot.status !== 'closed' && (
              <div className="detail__info-item detail__info-item--wide"><span className="detail__info-label">모집 마감 시각</span><span className="detail__info-value">{deadlineText}</span></div>
            )}
            {pot.orderCompletedAt && (
              <div className="detail__info-item detail__info-item--wide">
                <span className="detail__info-label">주문 완료 시각</span>
                <span className="detail__info-value">
                  {new Intl.DateTimeFormat('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  }).format(new Date(pot.orderCompletedAt))}
                </span>
              </div>
            )}
          </div>

          {pot.isManaging && pot.status === 'active' && (
            <section className="detail__management" aria-labelledby="deadline-management-title">
              <div className="detail__management-heading">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span className="detail__management-tag">👑 관리자 설정</span>
                  <h2 id="deadline-management-title" style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0 }}>모집 마감 및 설정</h2>
                </div>
              </div>

              <div className="detail__management-grid">
                <label className="detail__deadline-field">
                  <span>마감 시간 변경</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      disabled={isManagingDeadline}
                      max={maxDeadlineValue}
                      min={minDeadlineValue}
                      onChange={(event) => setDeadlineEdit({
                        source: data.pot.deadline,
                        value: event.target.value,
                      })}
                      type="datetime-local"
                      value={deadlineDraft}
                      style={{ flex: 1 }}
                    />
                    <button
                      disabled={isManagingDeadline || !canUpdateDeadline}
                      onClick={handleDeadlineUpdate}
                      type="button"
                      className="detail__deadline-update-btn"
                    >
                      {isManagingDeadline ? '...' : '변경'}
                    </button>
                  </div>
                </label>

                <div className="detail__management-row">
                  <label className="detail__deadline-field" style={{ flex: 1 }}>
                    <span>주문 종류</span>
                    <select
                      disabled={isManagingDeadline}
                      onChange={(e) => {
                        const val = e.target.value as 'lunch' | 'cafe' | 'other';
                        handleCategoryUpdate(val);
                      }}
                      value={effectiveCategory}
                    >
                      <option value="lunch">🍱 점심</option>
                      <option value="cafe">☕ 카페</option>
                      <option value="other">📦 기타</option>
                    </select>
                  </label>

                  <label className="detail__deadline-field" style={{ flex: 1 }}>
                    <span>최대 정원</span>
                    <select
                      disabled={isManagingDeadline}
                      onChange={(e) => {
                        const val = e.target.value;
                        const cap = val === 'none' ? null : Number(val);
                        handleMaxParticipantsUpdate(cap);
                      }}
                      value={pot.maxParticipants === null ? 'none' : String(pot.maxParticipants)}
                    >
                      <option value="none">제한 없음</option>
                      <option value="2">2명</option>
                      <option value="3">3명</option>
                      <option value="4">4명</option>
                      <option value="5">5명</option>
                      <option value="6">6명</option>
                      <option value="8">8명</option>
                      <option value="10">10명</option>
                      <option value="15">15명</option>
                      <option value="20">20명</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="detail__management-footer">
                <button
                  className="detail__close-now-btn"
                  disabled={isManagingDeadline}
                  onClick={handleCloseNow}
                  type="button"
                >
                  지금 마감
                </button>
                <button
                  className="detail__delete-pot-btn"
                  disabled={isDeletingPot || isManagingDeadline}
                  onClick={handleDeletePot}
                  type="button"
                >
                  {isDeletingPot ? '삭제 중...' : '🗑️ 팟 삭제'}
                </button>
              </div>
            </section>
          )}

          {neededForMinOrder !== null && pot.status !== 'closed' && (
            <p className="detail__feasibility">
              {pot.participantCount >= neededForMinOrder
                ? '✅ 대표메뉴 기준으로 최소주문금액을 채울 수 있어요.'
                : `대표메뉴 1개씩 주문한다면 최소 ${neededForMinOrder}명이 필요해 보여요. 현재 ${pot.participantCount}명이에요.`}
            </p>
          )}

          <div className="detail__menu-section">
            <h2 className="detail__section-title">대표 메뉴</h2>
            <div className="detail__menu-list">
              {restaurant.menus.length === 0 && <div className="detail__participant-hidden">대표 메뉴 정보가 아직 없어요.</div>}
              {restaurant.menus.map((menu) => (
                <div className="detail__menu-item" key={`${menu.name}-${menu.price}`}>
                  <span className="detail__menu-name">{menu.name}</span>
                  <span className="detail__menu-price">{menu.price}</span>
                </div>
              ))}
            </div>
            <div className="detail__report-row">
              <button
                type="button"
                className="detail__report-btn"
                onClick={() => setIsReportModalOpen(true)}
              >
                잘못된 정보가 있나요? 수정 제보하기 💬
              </button>
            </div>
          </div>

          <div className="detail__participants-section">
            <h2 className="detail__section-title">참여자 ({pot.participantCount}명)</h2>
            {!currentUser ? (
              <div className="detail__participant-hidden">
                {pot.status === 'closed'
                  ? '🔒 참여자 정보는 해당 팟 참여자만 확인할 수 있어요.'
                  : '🔒 로그인 후 참여하면 참여자를 확인할 수 있어요.'}
              </div>
            ) : pot.isParticipating && pot.participants ? (
              <>
                {pot.participants.map((participant, index) => {
                  const isMe = participant.isMe;
                  return (
                    <div
                      className={`detail__participant ${isMe ? 'detail__participant--me' : ''}`}
                      key={`${participant.name}-${index}`}
                    >
                      <div className="detail__participant-avatar">{participant.initial}</div>
                      <div className="detail__participant-info">
                        <div className="detail__participant-name-row">
                          <span className="detail__participant-name">{participant.name}</span>
                          {isMe && <span className="detail__participant-me-badge">나</span>}
                          {participant.isManager && <span className="detail__participant-badge">👑 관리자</span>}
                        </div>
                        {participant.orderMemo && (
                          <div className="detail__participant-memo-tag">
                            ✏️ {participant.orderMemo}
                          </div>
                        )}
                      </div>

                      <div className="detail__participant-actions">
                        {isMe || pot.isManaging ? (
                          <button
                            type="button"
                            className={`detail__paid-badge-btn ${participant.isPaid ? 'detail__paid-badge-btn--active' : ''}`}
                            onClick={() => handleTogglePaid(participant, index)}
                            disabled={isTogglingPaid}
                            title={isMe ? '클릭하여 송금 상태 변경' : `${participant.name}님 송금 상태 변경 (방장 권한)`}
                          >
                            {participant.isPaid ? '✓ 송금 완료' : (isMe ? '💸 미송금 (클릭)' : '미송금 (클릭)')}
                          </button>
                        ) : participant.isPaid ? (
                          <span className="detail__participant-paid-badge">✓ 송금 완료</span>
                        ) : (
                          <span className="detail__participant-unpaid-badge">미송금</span>
                        )}
                      </div>
                    </div>
                  );
                })}

                {myParticipant && (
                  <form
                    className="detail__my-memo-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveMemo(memoEdit ?? myParticipant.orderMemo ?? '');
                    }}
                  >
                    <div className="detail__my-memo-input-wrap">
                      <input
                        type="text"
                        className="detail__my-memo-input"
                        placeholder="내 주문 메모 입력 (예: 제육 1개, 맵기 덜맵게)"
                        value={memoEdit ?? myParticipant.orderMemo ?? ''}
                        onChange={(e) => setMemoEdit(e.target.value)}
                        maxLength={100}
                      />
                      <button
                        type="submit"
                        className="detail__my-memo-submit"
                        disabled={isSavingMemo}
                      >
                        {isSavingMemo ? '저장...' : '메모 저장'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            ) : (
              <div className="detail__participant-hidden">
                {pot.status === 'closed'
                  ? '참여자 정보는 해당 팟 참여자만 확인할 수 있어요.'
                  : '참여 후에 참여자 정보를 확인할 수 있어요.'}
              </div>
            )}
          </div>

          {action && <div className="pot-page__action">{action}</div>}
        </section>

        <aside className={`pot-page__chat ${mobileTab === 'chat' ? 'pot-page__panel--mobile-active' : ''}`}>
          <div className="pot-page__chat-header">
            <div><span>팟 채팅</span><p>{restaurant.name}</p></div>
            <Link href="/my">내 채팅방 보기 →</Link>
          </div>
          {pot.isParticipating && currentUser ? (
            <ChatPanel currentUser={currentUser} potId={pot.id} isActive={mobileTab === 'chat'} />
          ) : (
            <div className="pot-page__chat-locked">
              <span>💬</span>
              <strong>참여자 전용 채팅이에요</strong>
              <p>
                {pot.status === 'closed'
                  ? '마감된 팟의 대화는 기존 참여자만 확인할 수 있어요.'
                  : '팟에 참여하면 주문과 정산 이야기를 나눌 수 있어요.'}
              </p>
              {pot.status === 'active' && <button onClick={handleJoin} type="button">{currentUser ? '팟 참여하기' : '로그인하고 참여하기'}</button>}
            </div>
          )}
        </aside>
      </div>
      <ToastNotice toast={toast} />
      <StoreReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        restaurantName={restaurant.name}
        onSuccess={(msg) => showToast(msg, 'success')}
      />
    </main>
  );
}
