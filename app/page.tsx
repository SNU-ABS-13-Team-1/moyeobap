'use client';

import React, { useEffect, useMemo, useState } from 'react';
import useSWR from 'swr';
import './prototype.css';
import { User, Pot, Restaurant, ToastNotice as ToastNoticeType } from './types/moyeobap';
import { triggerConfetti } from './lib/moyeobap-utils';
import { fetcher } from './lib/fetcher';
import { Header } from './components/moyeobap/Header';
import { StatusBar } from './components/moyeobap/StatusBar';
import { PotCard } from './components/moyeobap/PotCard';
import { PotDetailModal } from './components/moyeobap/PotDetailModal';
import { CreatePotModal } from './components/moyeobap/CreatePotModal';
import { AuthModal } from './components/moyeobap/AuthModal';
import { ToastNotice } from './components/moyeobap/ToastNotice';

type ServerPot = Omit<Pot, 'deadline'> & { deadline: string };

function toPot(serverPot: ServerPot): Pot {
  return { ...serverPot, deadline: new Date(serverPot.deadline) };
}

export default function HomePage() {
  const [activeFilter, setActiveFilter] = useState<'all' | 'lunch' | 'cafe'>('all');
  const [selectedPotId, setSelectedPotId] = useState<string | null>(null);

  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  const [toast, setToast] = useState<ToastNoticeType | null>(null);

  // 1초마다 리렌더시켜서 카운트다운이 실시간으로 흐르게 합니다 (서버 재조회는 아님).
  const [, setTick] = useState(0);

  const { data: meData, mutate: mutateMe } = useSWR<{ user: User | null }>('/api/auth/me', fetcher);
  const { data: restaurantsData, mutate: mutateRestaurants } = useSWR<{ restaurants: Restaurant[] }>(
    '/api/restaurants',
    fetcher,
  );
  const { data: potsData, mutate: mutatePots } = useSWR<{ pots: ServerPot[] }>('/api/pots', fetcher, {
    refreshInterval: 4000,
  });

  const currentUser = meData?.user ?? null;
  const isAuthenticated = Boolean(currentUser);
  const restaurants = useMemo(() => restaurantsData?.restaurants ?? [], [restaurantsData]);
  const pots = useMemo(() => (potsData?.pots ?? []).map(toPot), [potsData]);

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  function showToast(message: string, type: 'success' | 'warning' | 'error' = 'success') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleAuthToggle() {
    if (isAuthenticated) {
      await fetch('/api/auth/logout', { method: 'POST' });
      await mutateMe();
      await mutatePots();
      setIsDetailOpen(false);
      showToast('로그아웃 되었습니다.', 'success');
    } else {
      setIsAuthOpen(true);
    }
  }

  async function handleLogin(email: string, name: string): Promise<string | null> {
    const resp = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name }),
    });
    const data = await resp.json();
    if (!resp.ok) return data.error ?? '로그인에 실패했어요.';

    await mutateMe();
    setIsAuthOpen(false);
    showToast(`환영합니다, ${data.user.name}님! 🎉`, 'success');
    return null;
  }

  async function handleJoinPot(potId: string) {
    if (!isAuthenticated) {
      setIsAuthOpen(true);
      return;
    }
    const resp = await fetch(`/api/pots/${potId}/join`, { method: 'POST' });
    const data = await resp.json();
    if (!resp.ok) {
      showToast(data.error ?? '참여하지 못했어요.', 'error');
      return;
    }
    await mutatePots();
    const r = restaurants.find((item) => item.id === data.pot.restaurantId);
    showToast(`${r?.name || ''}에 탑승했어요! 🚀`, 'success');
    triggerConfetti();
  }

  async function handleLeavePot(potId: string) {
    const resp = await fetch(`/api/pots/${potId}/leave`, { method: 'POST' });
    const data = await resp.json();
    if (!resp.ok) {
      showToast(data.error ?? '참여 취소에 실패했어요.', 'error');
      return;
    }
    await mutatePots();
    const r = restaurants.find((item) => item.id === data.pot.restaurantId);
    if (data.pot.participants.length === 0) {
      showToast(`${r?.name || ''} 팟이 종료되었습니다.`, 'error');
      setIsDetailOpen(false);
    } else {
      showToast(`${r?.name || ''} 탑승을 취소했습니다.`, 'error');
    }
  }

  async function handleCreateCustomRestaurant(input: {
    name: string;
    category: 'lunch' | 'cafe';
  }): Promise<string | null> {
    const resp = await fetch('/api/restaurants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await resp.json();
    if (!resp.ok) return null;
    await mutateRestaurants();
    return data.restaurant.id as string;
  }

  async function handleCreateSubmit(restaurantId: string, minutes: number, maxParticipants: number | null) {
    const resp = await fetch('/api/pots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restaurantId, minutes, maxParticipants }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      showToast(data.error ?? '팟을 만들지 못했어요.', 'error');
      return;
    }
    await mutatePots();
    setIsCreateOpen(false);
    const r = restaurants.find((item) => item.id === restaurantId);
    if (activeFilter !== 'all' && r && activeFilter !== r.category) {
      setActiveFilter('all');
    }
    showToast(`${r?.name || ''} 팟이 생성되었습니다! ✨`, 'success');
    triggerConfetti();
  }

  const filteredPots = pots
    .filter((p) => {
      if (activeFilter === 'all') return true;
      const r = restaurants.find((item) => item.id === p.restaurantId);
      return r?.category === activeFilter;
    })
    .sort((a, b) => {
      if (a.status === 'closed' && b.status !== 'closed') return 1;
      if (a.status !== 'closed' && b.status === 'closed') return -1;
      return a.deadline.getTime() - b.deadline.getTime();
    });

  const activePotsCount = pots.filter((p) => p.status === 'active').length;
  const totalParticipantsCount = pots.reduce((sum, p) => sum + p.participants.length, 0);

  const selectedPot = pots.find((p) => p.id === selectedPotId);
  const selectedRestaurant = selectedPot
    ? restaurants.find((r) => r.id === selectedPot.restaurantId)
    : null;

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
        <main className="grid">
          {filteredPots.length === 0 ? (
            <div className="empty">
              <div className="empty__emoji">🍽️</div>
              <h2 className="empty__title">아직 열린 팟이 없어요</h2>
              <p className="empty__desc">첫 번째 팟을 만들어 동료들을 모아보세요!</p>
            </div>
          ) : (
            filteredPots.map((pot, index) => {
              const r = restaurants.find((res) => res.id === pot.restaurantId);
              if (!r) return null;

              return (
                <PotCard
                  key={pot.id}
                  pot={pot}
                  restaurant={r}
                  isAuthenticated={isAuthenticated}
                  currentUser={currentUser}
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
