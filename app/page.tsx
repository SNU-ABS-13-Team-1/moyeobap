'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import './prototype.css';
import type { Pot, Restaurant, SerializedPot, User } from './types/moyeobap';
import { triggerConfetti } from './lib/moyeobap-utils';
import { fetcher } from './lib/fetcher';
import { getErrorMessage, requestJson } from './lib/api-client';
import { useClock } from './hooks/useClock';
import { useToastNotice } from './hooks/useToastNotice';
import { Header } from './components/moyeobap/Header';
import { StatusBar } from './components/moyeobap/StatusBar';
import { PotCard } from './components/moyeobap/PotCard';
import { PotDetailModal } from './components/moyeobap/PotDetailModal';
import { CreatePotModal } from './components/moyeobap/CreatePotModal';
import { AuthModal } from './components/moyeobap/AuthModal';
import { ToastNotice } from './components/moyeobap/ToastNotice';

function toPot(serverPot: SerializedPot): Pot {
  return { ...serverPot, deadline: new Date(serverPot.deadline) };
}

type PotResponse = { pot: SerializedPot };
type LoginResponse = { user: User };
type RestaurantResponse = { restaurant: Restaurant };

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'lunch' | 'cafe'>('all');
  const [selectedPotId, setSelectedPotId] = useState<string | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const now = useClock();
  const { toast, showToast } = useToastNotice();

  const { data: meData, mutate: mutateMe } = useSWR<{ user: User | null }>('/api/auth/me', fetcher);
  const {
    data: restaurantsData,
    error: restaurantsError,
    mutate: mutateRestaurants,
  } = useSWR<{ restaurants: Restaurant[] }>(
    '/api/restaurants',
    fetcher,
  );
  const {
    data: potsData,
    error: potsError,
    mutate: mutatePots,
  } = useSWR<{ pots: SerializedPot[] }>('/api/pots', fetcher, { refreshInterval: 4000 });

  const currentUser = meData?.user ?? null;
  const isAuthenticated = Boolean(currentUser);
  const restaurants = useMemo(() => restaurantsData?.restaurants ?? [], [restaurantsData]);
  const pots = useMemo(() => (potsData?.pots ?? []).map(toPot), [potsData]);
  const restaurantsById = useMemo(
    () => new Map(restaurants.map((restaurant) => [restaurant.id, restaurant])),
    [restaurants],
  );

  async function handleAuthToggle() {
    if (isAuthenticated) {
      try {
        await requestJson('/api/auth/logout', { method: 'POST' });
        await Promise.all([mutateMe(), mutatePots()]);
        setIsDetailOpen(false);
        showToast('로그아웃 되었습니다.', 'success');
      } catch (error) {
        showToast(getErrorMessage(error, '로그아웃하지 못했어요.'), 'error');
      }
    } else {
      setIsAuthOpen(true);
    }
  }

  async function handleLogin(email: string, name: string, bankAccount: string): Promise<string | null> {
    try {
      const data = await requestJson<LoginResponse>('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, bankAccount }),
      });
      await Promise.all([mutateMe(), mutatePots()]);
      setIsAuthOpen(false);
      showToast(`환영합니다, ${data.user.name}님! 🎉`, 'success');
      return null;
    } catch (error) {
      return getErrorMessage(error, '로그인에 실패했어요.');
    }
  }

  async function handleJoinPot(potId: string) {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }
    try {
      const data = await requestJson<PotResponse>(`/api/pots/${potId}/join`, { method: 'POST' });
      await mutatePots();
      const restaurant = restaurantsById.get(data.pot.restaurantId);
      showToast(`${restaurant?.name ?? ''}에 탑승했어요! 🚀`, 'success');
      triggerConfetti();
    } catch (error) {
      showToast(getErrorMessage(error, '참여하지 못했어요.'), 'error');
    }
  }

  async function handleLeavePot(potId: string) {
    try {
      const data = await requestJson<PotResponse>(`/api/pots/${potId}/leave`, { method: 'POST' });
      await mutatePots();
      const restaurant = restaurantsById.get(data.pot.restaurantId);
      if (data.pot.participantCount === 0) {
        showToast(`${restaurant?.name ?? ''} 팟이 종료되었습니다.`, 'warning');
        setIsDetailOpen(false);
      } else {
        showToast(`${restaurant?.name ?? ''} 탑승을 취소했습니다.`, 'warning');
      }
    } catch (error) {
      showToast(getErrorMessage(error, '참여 취소에 실패했어요.'), 'error');
    }
  }

  async function handleCreateCustomRestaurant(input: {
    name: string;
    category: 'lunch' | 'cafe';
  }): Promise<string | null> {
    try {
      const data = await requestJson<RestaurantResponse>('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await mutateRestaurants();
      return data.restaurant.id;
    } catch {
      return null;
    }
  }

  async function handleCreateSubmit(
    restaurantId: string,
    minutes: number,
    maxParticipants: number | null,
  ): Promise<string | null> {
    try {
      await requestJson<PotResponse>('/api/pots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, minutes, maxParticipants }),
      });
      await mutatePots();
      setIsCreateOpen(false);
      const restaurant = restaurantsById.get(restaurantId);
      if (activeFilter !== 'all' && restaurant && activeFilter !== restaurant.category) {
        setActiveFilter('all');
      }
      showToast(`${restaurant?.name ?? ''} 팟이 생성되었습니다! ✨`, 'success');
      triggerConfetti();
      return null;
    } catch (error) {
      return getErrorMessage(error, '팟을 만들지 못했어요.');
    }
  }

  const filteredPots = useMemo(
    () => pots
      .filter((pot) => {
        if (activeFilter === 'all') return true;
        return restaurantsById.get(pot.restaurantId)?.category === activeFilter;
      })
      .sort((a, b) => {
        if (a.status === 'closed' && b.status !== 'closed') return 1;
        if (a.status !== 'closed' && b.status === 'closed') return -1;
        return a.deadline.getTime() - b.deadline.getTime();
      }),
    [activeFilter, pots, restaurantsById],
  );

  const activePotsCount = pots.filter((p) => p.status === 'active').length;
  const totalParticipantsCount = pots.reduce((sum, pot) => sum + pot.participantCount, 0);
  const isInitialLoading = !potsData || !restaurantsData;
  const hasLoadError = Boolean(potsError || restaurantsError);

  const selectedPot = pots.find((p) => p.id === selectedPotId);
  const selectedRestaurant = selectedPot ? restaurantsById.get(selectedPot.restaurantId) : null;

  return (
    <div className="moyeobap-body">
      <div className="app">
        {/* Header */}
        <Header
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          isAuthenticated={isAuthenticated}
          currentUser={currentUser}
          onAuthClick={handleAuthToggle}
        />

        {/* Status Bar */}
        <StatusBar
          activePotsCount={activePotsCount}
          totalParticipantsCount={totalParticipantsCount}
        />

        {/* Main Grid */}
        <main aria-busy={isInitialLoading} className="grid">
          {hasLoadError ? (
            <div className="empty" role="alert">
              <div className="empty__emoji">⚠️</div>
              <h2 className="empty__title">현황을 불러오지 못했어요</h2>
              <p className="empty__desc">잠시 뒤 새로고침해주세요.</p>
            </div>
          ) : isInitialLoading ? (
            <div className="empty">
              <div className="empty__emoji">🍚</div>
              <p className="empty__desc">모집 현황을 불러오는 중이에요...</p>
            </div>
          ) : filteredPots.length === 0 ? (
            <div className="empty">
              <div className="empty__emoji">🍽️</div>
              <h2 className="empty__title">아직 열린 팟이 없어요</h2>
              <p className="empty__desc">첫 번째 팟을 만들어 동료들을 모아보세요!</p>
            </div>
          ) : (
            filteredPots.map((pot, index) => {
              const restaurant = restaurantsById.get(pot.restaurantId);
              if (!restaurant) return null;

              return (
                <PotCard
                  key={pot.id}
                  pot={pot}
                  restaurant={restaurant}
                  isAuthenticated={isAuthenticated}
                  now={now}
                  index={index}
                  onCardClick={(potId) => {
                    setSelectedPotId(potId);
                    setIsDetailOpen(true);
                  }}
                  onJoinClick={handleJoinPot}
                  onOpenAuth={() => setIsAuthOpen(true)}
                />
              );
            })
          )}
        </main>

        {/* FAB Button */}
        <button
          className="fab"
          onClick={() => {
            if (!isAuthenticated) {
              setIsAuthOpen(true);
            } else {
              setIsCreateOpen(true);
            }
          }}
          aria-label="새 팟 만들기"
        >
          <span className="fab__icon">+</span>
          <span className="fab__tooltip">새 팟 만들기</span>
        </button>

        {/* Detail Modal */}
        {isDetailOpen && selectedPot && selectedRestaurant && (
          <PotDetailModal
            pot={selectedPot}
            restaurant={selectedRestaurant}
            isAuthenticated={isAuthenticated}
            currentUser={currentUser}
            now={now}
            onClose={() => setIsDetailOpen(false)}
            onJoin={handleJoinPot}
            onLeave={handleLeavePot}
            onOpenAuth={() => setIsAuthOpen(true)}
          />
        )}

        {/* Create Modal */}
        {isCreateOpen && (
          <CreatePotModal
            restaurants={restaurants}
            onClose={() => setIsCreateOpen(false)}
            onCreateCustomRestaurant={handleCreateCustomRestaurant}
            onSubmit={handleCreateSubmit}
          />
        )}

        {/* Auth Modal */}
        {isAuthOpen && (
          <AuthModal onClose={() => setIsAuthOpen(false)} onLogin={handleLogin} />
        )}

        {/* Toast */}
        <ToastNotice toast={toast} />
      </div>
    </div>
  );
}
