'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { Pot, Restaurant, SerializedPot } from './types/moyeobap';
import { fetcher } from './lib/fetcher';
import { getErrorMessage, requestJson } from './lib/api-client';
import { useClock } from './hooks/useClock';
import { useToastNotice } from './hooks/useToastNotice';
import { useAuth } from './components/moyeobap/AuthProvider';
import { DashboardFilters } from './components/moyeobap/DashboardFilters';
import { PotCard } from './components/moyeobap/PotCard';
import { ToastNotice } from './components/moyeobap/ToastNotice';

import { groupPotsByDate } from './lib/moyeobap-utils';

function toPot(serverPot: SerializedPot): Pot {
  return { ...serverPot, deadline: new Date(serverPot.deadline) };
}

type PotResponse = { pot: SerializedPot };

export default function HomePage() {
  const router = useRouter();
  const { currentUser, openAuth } = useAuth();
  const [statusFilter, setStatusFilterState] = useState<'active' | 'closed'>('active');
  const [categoryFilter, setCategoryFilterState] = useState<'all' | 'lunch' | 'cafe' | 'other'>('all');
  const now = useClock();
  const { toast, showToast } = useToastNotice();

  const { data: restaurantsData, error: restaurantsError } = useSWR<{
    restaurants: Restaurant[];
  }>('/api/restaurants', fetcher);
  const { data: potsData, error: potsError, mutate: mutatePots } = useSWR<{
    pots: SerializedPot[];
  }>('/api/pots', fetcher, {
    refreshInterval: 12000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });

  const restaurants = useMemo(() => restaurantsData?.restaurants ?? [], [restaurantsData]);
  const pots = useMemo(() => (potsData?.pots ?? []).map(toPot), [potsData]);
  const restaurantsById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const category = params.get('category');
    const timer = window.setTimeout(() => {
      if (status === 'closed') setStatusFilterState('closed');
      if (category === 'lunch' || category === 'cafe' || category === 'other') setCategoryFilterState(category);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function syncFilters(status: 'active' | 'closed', category: 'all' | 'lunch' | 'cafe' | 'other') {
    const params = new URLSearchParams();
    if (status !== 'active') params.set('status', status);
    if (category !== 'all') params.set('category', category);
    window.history.replaceState(null, '', `/${params.size ? `?${params}` : ''}`);
  }

  function setStatusFilter(status: 'active' | 'closed') {
    setStatusFilterState(status);
    syncFilters(status, categoryFilter);
  }

  function setCategoryFilter(category: 'all' | 'lunch' | 'cafe' | 'other') {
    setCategoryFilterState(category);
    syncFilters(statusFilter, category);
  }

  async function handleJoinPot(potId: string) {
    if (!currentUser) {
      openAuth(`/pots/${encodeURIComponent(potId)}`);
      return;
    }

    // 낙관적 UI 업데이트 (0ms 즉시 참여 상태 및 인원수 +1 반영)
    const targetPot = pots.find((p) => p.id === potId);
    const restaurant = targetPot ? restaurantsById.get(targetPot.restaurantId) : undefined;

    mutatePots((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        pots: prev.pots.map((p) =>
          p.id === potId
            ? { ...p, isParticipating: true, participantCount: p.participantCount + 1 }
            : p,
        ),
      };
    }, false);

    showToast(`${restaurant?.name ?? ''} 팟에 참여했어요.`, 'success');

    try {
      await requestJson<PotResponse>(`/api/pots/${potId}/join`, { method: 'POST' });
      await mutatePots();
    } catch (error) {
      await mutatePots();
      showToast(getErrorMessage(error, '참여하지 못했어요.'), 'error');
    }
  }

  const filteredPots = useMemo(
    () => pots
      .filter((pot) => {
        if (pot.status !== statusFilter) return false;
        if (categoryFilter === 'all') return true;
        const effectiveCategory = pot.category ?? restaurantsById.get(pot.restaurantId)?.category;
        return effectiveCategory === categoryFilter;
      })
      .sort((a, b) => statusFilter === 'closed'
        ? b.deadline.getTime() - a.deadline.getTime()
        : a.deadline.getTime() - b.deadline.getTime()),
    [categoryFilter, pots, restaurantsById, statusFilter],
  );

  const closedGroupedPots = useMemo(
    () => (statusFilter === 'closed' ? groupPotsByDate(filteredPots, now) : []),
    [filteredPots, now, statusFilter],
  );

  const activePotsCount = pots.filter((pot) => pot.status === 'active').length;
  const closedPotsCount = pots.filter((pot) => pot.status === 'closed').length;
  const isInitialLoading = !potsData || !restaurantsData;
  const hasLoadError = Boolean(potsError || restaurantsError);

  return (
    <>
      <div className="dashboard-toolbar">
        <DashboardFilters
          activeCount={activePotsCount}
          categoryFilter={categoryFilter}
          closedCount={closedPotsCount}
          setCategoryFilter={setCategoryFilter}
          setStatusFilter={setStatusFilter}
          statusFilter={statusFilter}
        />
      </div>

      <main aria-busy={isInitialLoading}>
        {hasLoadError ? (
          <div className="empty" role="alert">
            <div className="empty__emoji">⚠️</div>
            <h2 className="empty__title">현황을 불러오지 못했어요</h2>
            <p className="empty__desc">잠시 뒤 새로고침해주세요.</p>
          </div>
        ) : isInitialLoading ? (
          <div className="empty">
            <div className="empty__emoji">
              <Image
                alt=""
                className="empty__emoji-img"
                height={52}
                priority
                src="/icon.png"
                width={52}
              />
            </div>
            <p className="empty__desc">모집 현황을 불러오는 중이에요...</p>
          </div>
        ) : filteredPots.length === 0 ? (
          <div className="empty">
            <div className="empty__emoji">{statusFilter === 'closed' ? '🗂️' : '🍽️'}</div>
            <h2 className="empty__title">
              {statusFilter === 'closed' ? '아직 마감된 팟이 없어요' : '아직 열린 팟이 없어요'}
            </h2>
          </div>
        ) : statusFilter === 'closed' ? (
          closedGroupedPots.map((group) => (
            <section className="dashboard-date-section" key={group.dateLabel}>
              <h3 className="dashboard-date-header">{group.dateLabel}</h3>
              <div className="grid">
                {group.pots.map((pot) => {
                  const restaurant = restaurantsById.get(pot.restaurantId);
                  if (!restaurant) return null;
                  return (
                    <PotCard
                      isAuthenticated={Boolean(currentUser)}
                      key={pot.id}
                      now={now}
                      onJoinClick={handleJoinPot}
                      onOpenAuth={(potId) => openAuth(`/pots/${encodeURIComponent(potId)}`)}
                      pot={pot}
                      restaurant={restaurant}
                    />
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="grid">
            {filteredPots.map((pot) => {
              const restaurant = restaurantsById.get(pot.restaurantId);
              if (!restaurant) return null;
              return (
                <PotCard
                  isAuthenticated={Boolean(currentUser)}
                  key={pot.id}
                  now={now}
                  onJoinClick={handleJoinPot}
                  onOpenAuth={(potId) => openAuth(`/pots/${encodeURIComponent(potId)}`)}
                  pot={pot}
                  restaurant={restaurant}
                />
              );
            })}
          </div>
        )}
      </main>

      <button
        aria-label="새 팟 만들기"
        className="fab"
        onClick={() => currentUser ? router.push('/pots/new') : openAuth('/pots/new')}
        type="button"
      >
        <span className="fab__icon">+</span>
        <span className="fab__tooltip">새 팟 만들기</span>
      </button>
      <ToastNotice toast={toast} />
    </>
  );
}
