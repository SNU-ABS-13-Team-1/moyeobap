'use client';

import React, { useState, useEffect } from 'react';
import './prototype.css';
import { User, Pot, ToastNotice as ToastNoticeType } from './types/moyeobap';
import { RESTAURANTS, CURRENT_USER, createInitialPots } from './data/moyeobap-mock';
import { triggerConfetti } from './lib/moyeobap-utils';
import { Header } from './components/moyeobap/Header';
import { StatusBar } from './components/moyeobap/StatusBar';
import { PotCard } from './components/moyeobap/PotCard';
import { PotDetailModal } from './components/moyeobap/PotDetailModal';
import { CreatePotModal } from './components/moyeobap/CreatePotModal';
import { AuthModal } from './components/moyeobap/AuthModal';
import { ToastNotice } from './components/moyeobap/ToastNotice';

export default function HomePage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'lunch' | 'cafe'>('all');
  const [pots, setPots] = useState<Pot[]>([]);
  const [selectedPotId, setSelectedPotId] = useState<string | null>(null);

  // Modals
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastNoticeType | null>(null);

  // Timer Tick Trigger
  const [, setTick] = useState(0);

  useEffect(() => {
    setPots(createInitialPots());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);

      setPots(prevPots => {
        let changed = false;
        const updated = prevPots.map(pot => {
          if (pot.status !== 'active') return pot;
          const remaining = pot.deadline.getTime() - Date.now();

          if (remaining <= 0) {
            changed = true;
            const r = RESTAURANTS.find(res => res.id === pot.restaurantId);
            if (pot.participants.length >= 2) {
              showToast(`${r?.name || ''} 팟이 마감되었습니다! Slack에서 주문을 진행해주세요 🎉`, 'success');
              return { ...pot, status: 'closed' as const };
            } else {
              showToast(`${r?.name || ''} 팟이 인원 미달로 종료되었습니다`, 'error');
              return { ...pot, status: 'failed' as const };
            }
          }
          return pot;
        });

        if (changed) {
          return updated.filter(p => p.status !== 'failed');
        }
        return prevPots;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const showToast = (message: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const handleAuthToggle = () => {
    if (isAuthenticated) {
      setPots(prev => prev.map(p => {
        if (p.status === 'active') {
          return { ...p, participants: p.participants.filter(user => user.id !== currentUser?.id) };
        }
        return p;
      }).filter(p => p.participants.length > 0));

      setIsAuthenticated(false);
      setCurrentUser(null);
      setIsDetailOpen(false);
      showToast('로그아웃 되었습니다.', 'success');
    } else {
      setIsAuthOpen(true);
    }
  };

  const mockLogin = () => {
    setIsAuthenticated(true);
    setCurrentUser({ ...CURRENT_USER });
    setIsAuthOpen(false);
    showToast(`환영합니다, ${CURRENT_USER.name}님! 🎉`, 'success');
  };

  const handleJoinPot = (potId: string) => {
    if (!isAuthenticated || !currentUser) {
      setIsAuthOpen(true);
      return;
    }

    setPots(prev => prev.map(p => {
      if (p.id === potId && p.status === 'active') {
        if (!p.participants.some(user => user.id === currentUser.id)) {
          const r = RESTAURANTS.find(res => res.id === p.restaurantId);
          showToast(`${r?.name || ''}에 탑승했어요! 🚀`, 'success');
          triggerConfetti();
          return { ...p, participants: [...p.participants, currentUser] };
        }
      }
      return p;
    }));
  };

  const handleLeavePot = (potId: string) => {
    if (!currentUser) return;
    setPots(prev => {
      const updated = prev.map(p => {
        if (p.id === potId && p.status === 'active') {
          const newParts = p.participants.filter(u => u.id !== currentUser.id);
          return { ...p, participants: newParts };
        }
        return p;
      });

      const target = updated.find(p => p.id === potId);
      const r = RESTAURANTS.find(res => res.id === target?.restaurantId);
      if (target && target.participants.length === 0) {
        showToast(`${r?.name || ''} 팟이 종료되었습니다.`, 'error');
        setIsDetailOpen(false);
        return updated.filter(p => p.id !== potId);
      } else {
        showToast(`${r?.name || ''} 탑승을 취소했습니다.`, 'error');
        return updated;
      }
    });
  };

  const handleCreateSubmit = (restaurantId: string, minutes: number) => {
    if (!currentUser) return;
    const r = RESTAURANTS.find(res => res.id === restaurantId);
    if (!r) return;

    const now = new Date();
    const newPot: Pot = {
      id: Math.random().toString(36).substring(2, 9),
      restaurantId,
      deadline: new Date(now.getTime() + minutes * 60000),
      participants: [currentUser],
      status: 'active'
    };

    setPots(prev => [...prev, newPot]);
    setIsCreateOpen(false);
    if (activeFilter !== 'all' && activeFilter !== r.category) {
      setActiveFilter('all');
    }
    showToast(`${r.name} 팟이 생성되었습니다! ✨`, 'success');
    triggerConfetti();
  };

  const filteredPots = pots.filter(p => {
    if (activeFilter === 'all') return true;
    const r = RESTAURANTS.find(res => res.id === p.restaurantId);
    return r?.category === activeFilter;
  }).sort((a, b) => {
    if (a.status === 'closed' && b.status !== 'closed') return 1;
    if (a.status !== 'closed' && b.status === 'closed') return -1;
    return a.deadline.getTime() - b.deadline.getTime();
  });

  const activePotsCount = pots.filter(p => p.status === 'active').length;
  const totalParticipantsCount = pots.reduce((sum, p) => sum + p.participants.length, 0);

  const selectedPot = pots.find(p => p.id === selectedPotId);
  const selectedRestaurant = selectedPot ? RESTAURANTS.find(r => r.id === selectedPot.restaurantId) : null;

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
              const r = RESTAURANTS.find(res => res.id === pot.restaurantId);
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
            restaurants={RESTAURANTS}
            onClose={() => setIsCreateOpen(false)}
            onSubmit={handleCreateSubmit}
          />
        )}

        {/* Auth Modal */}
        {isAuthOpen && (
          <AuthModal
            onClose={() => setIsAuthOpen(false)}
            onLogin={mockLogin}
          />
        )}

        {/* Toast */}
        <ToastNotice toast={toast} />
      </div>
    </div>
  );
}
