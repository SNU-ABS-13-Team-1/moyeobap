'use client';

import React, { useState, useEffect } from 'react';
import './prototype.css';

interface Menu {
  name: string;
  price: string;
}

interface Restaurant {
  id: string;
  name: string;
  emoji: string;
  category: 'lunch' | 'cafe';
  minOrder: number;
  deliveryTime: string;
  menus: Menu[];
}

interface User {
  id: string;
  name: string;
  initial: string;
}

interface Pot {
  id: string;
  restaurantId: string;
  deadline: Date;
  participants: User[];
  status: 'active' | 'closed' | 'failed';
}

const RESTAURANTS: Restaurant[] = [
  { id: 'bbq', name: 'BBQ치킨', emoji: '🍗', category: 'lunch', minOrder: 18000, deliveryTime: '35~45분', menus: [{name: '황금올리브치킨', price: '20,900원'}, {name: '자메이카 통다리', price: '19,900원'}, {name: '양념치킨', price: '19,900원'}, {name: '치킨+콜라 세트', price: '22,900원'}] },
  { id: 'dominos', name: '도미노피자', emoji: '🍕', category: 'lunch', minOrder: 20000, deliveryTime: '30~40분', menus: [{name: '포테이토 피자 L', price: '24,900원'}, {name: '슈퍼디럭스 L', price: '29,900원'}, {name: '치즈케이크 피자', price: '22,900원'}, {name: '피자+사이드 세트', price: '28,900원'}] },
  { id: 'momstouch', name: '맘스터치', emoji: '🍔', category: 'lunch', minOrder: 15000, deliveryTime: '25~35분', menus: [{name: '싸이버거', price: '5,400원'}, {name: '불싸이버거', price: '6,200원'}, {name: '치즈싸이버거', price: '6,700원'}, {name: '후라이드+양념 세트', price: '17,900원'}] },
  { id: 'subway', name: '서브웨이', emoji: '🥪', category: 'lunch', minOrder: 14000, deliveryTime: '25~35분', menus: [{name: 'BMT 30cm', price: '9,900원'}, {name: '에그마요 30cm', price: '8,400원'}, {name: '스테이크&치즈', price: '10,900원'}, {name: '쿠키+음료 세트', price: '3,500원'}] },
  { id: 'tteok', name: '엽기떡볶이', emoji: '🌶️', category: 'lunch', minOrder: 16000, deliveryTime: '30~40분', menus: [{name: '엽기떡볶이', price: '14,000원'}, {name: '엽기오뎅', price: '13,000원'}, {name: '중국당면 추가', price: '2,000원'}, {name: '주먹밥', price: '1,500원'}] },
  { id: 'kimbap', name: '김밥천국', emoji: '🍙', category: 'lunch', minOrder: 12000, deliveryTime: '20~30분', menus: [{name: '참치김밥', price: '4,000원'}, {name: '치즈돈까스', price: '8,000원'}, {name: '라볶이', price: '7,000원'}, {name: '제육볶음', price: '8,500원'}] },
  { id: 'starbucks', name: '스타벅스', emoji: '☕', category: 'cafe', minOrder: 15000, deliveryTime: '20~30분', menus: [{name: '아이스 아메리카노', price: '4,500원'}, {name: '카페라떼', price: '5,000원'}, {name: '바닐라 프라푸치노', price: '5,900원'}, {name: '조각 케이크', price: '6,500원'}] },
  { id: 'mega', name: '메가커피', emoji: '🥤', category: 'cafe', minOrder: 10000, deliveryTime: '15~25분', menus: [{name: '아이스 아메리카노', price: '2,000원'}, {name: '카페라떼', price: '3,000원'}, {name: '딸기라떼', price: '4,000원'}, {name: '망고스무디', price: '4,500원'}] },
  { id: 'ediya', name: '이디야커피', emoji: '🫖', category: 'cafe', minOrder: 12000, deliveryTime: '20~30분', menus: [{name: '아이스 아메리카노', price: '3,200원'}, {name: '토피넛라떼', price: '4,500원'}, {name: '민트초코라떼', price: '4,300원'}, {name: '허니자몽티', price: '4,500원'}] },
  { id: 'bsg', name: '백스비어', emoji: '🍺', category: 'lunch', minOrder: 20000, deliveryTime: '35~45분', menus: [{name: '양념치킨', price: '18,000원'}, {name: '간장치킨', price: '18,000원'}, {name: '치즈볼', price: '5,000원'}, {name: '감자튀김', price: '4,000원'}] }
];

const MOCK_USERS: User[] = [
  { id: 'u1', name: '김서연', initial: '서' },
  { id: 'u2', name: '이준호', initial: '준' },
  { id: 'u3', name: '박지민', initial: '민' },
  { id: 'u4', name: '최현우', initial: '현' },
  { id: 'u5', name: '정수아', initial: '수' },
  { id: 'u6', name: '한도윤', initial: '도' },
  { id: 'u7', name: '오지후', initial: '후' },
  { id: 'u8', name: '윤서윤', initial: '윤' },
];

const CURRENT_USER: User = { id: 'me', name: '나', initial: '나' };

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

  // Create Modal State
  const [searchTerm, setSearchTerm] = useState('');
  const [createRestaurantId, setCreateRestaurantId] = useState<string | null>(null);
  const [createMinutes, setCreateMinutes] = useState(30);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'warning' | 'error' } | null>(null);

  // Timer Tick Trigger
  const [, setTick] = useState(0);

  useEffect(() => {
    const now = new Date();
    const initialPots: Pot[] = [
      {
        id: 'p1',
        restaurantId: 'bbq',
        deadline: new Date(now.getTime() + 7 * 60000),
        participants: [MOCK_USERS[0], MOCK_USERS[1], MOCK_USERS[2]],
        status: 'active'
      },
      {
        id: 'p2',
        restaurantId: 'starbucks',
        deadline: new Date(now.getTime() + 18 * 60000),
        participants: [MOCK_USERS[3], MOCK_USERS[4]],
        status: 'active'
      },
      {
        id: 'p3',
        restaurantId: 'dominos',
        deadline: new Date(now.getTime() + 2 * 60000),
        participants: [MOCK_USERS[5], MOCK_USERS[6], MOCK_USERS[7], MOCK_USERS[0], MOCK_USERS[1]],
        status: 'active'
      },
      {
        id: 'p4',
        restaurantId: 'mega',
        deadline: new Date(now.getTime() + 25 * 60000),
        participants: [MOCK_USERS[2]],
        status: 'active'
      },
      {
        id: 'p5',
        restaurantId: 'tteok',
        deadline: new Date(now.getTime() + 12 * 60000),
        participants: [MOCK_USERS[3], MOCK_USERS[4], MOCK_USERS[5], MOCK_USERS[6]],
        status: 'active'
      }
    ];
    setPots(initialPots);
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

  const triggerConfetti = () => {
    if (typeof window === 'undefined') return;
    const colors = ['#FF6B35', '#FF8C42', '#7C5CFC', '#22C55E', '#F59E0B', '#EF4444', '#3B82F6', '#EC4899', '#A78BFA', '#34D399'];

    for (let i = 0; i < 35; i++) {
      const el = document.createElement('div');
      const size = Math.random() * 8 + 4;
      el.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 400;
        width: ${size}px;
        height: ${size}px;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
        left: ${Math.random() * 100}vw;
        top: -10px;
      `;

      document.body.appendChild(el);

      const duration = 1500 + Math.random() * 2000;
      const delay = Math.random() * 500;
      const targetX = (Math.random() - 0.5) * 300;
      const rotation = Math.random() * 720 - 360;

      el.animate([
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${targetX}px, ${window.innerHeight + 50}px) rotate(${rotation}deg)`, opacity: 0 }
      ], {
        duration,
        delay,
        easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        fill: 'forwards'
      }).onfinish = () => el.remove();
    }
  };

  const getTimeRemaining = (deadline: Date) => {
    const total = deadline.getTime() - Date.now();
    const minutes = Math.max(0, Math.floor(total / 60000));
    const seconds = Math.max(0, Math.floor((total / 1000) % 60));
    return {
      total,
      minutes,
      seconds,
      isUrgent: total > 0 && total <= 5 * 60000,
      isExpired: total <= 0
    };
  };

  const formatTime = (m: number, s: number) => {
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleAuthToggle = () => {
    if (isAuthenticated) {
      // Logout
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

  const handleCreateSubmit = () => {
    if (!createRestaurantId || !currentUser) return;
    const r = RESTAURANTS.find(res => res.id === createRestaurantId);
    if (!r) return;

    const now = new Date();
    const newPot: Pot = {
      id: Math.random().toString(36).substring(2, 9),
      restaurantId: createRestaurantId,
      deadline: new Date(now.getTime() + createMinutes * 60000),
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
        <header className="header">
          <div className="header__logo">
            <span className="header__logo-emoji">🍚</span>
            <span className="header__logo-text text-gradient">모여밥</span>
          </div>

          <nav className="header__nav">
            <button
              className={`header__tab ${activeFilter === 'all' ? 'header__tab--active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              전체
            </button>
            <button
              className={`header__tab ${activeFilter === 'lunch' ? 'header__tab--active' : ''}`}
              onClick={() => setActiveFilter('lunch')}
            >
              점심 🍱
            </button>
            <button
              className={`header__tab ${activeFilter === 'cafe' ? 'header__tab--active' : ''}`}
              onClick={() => setActiveFilter('cafe')}
            >
              카페 ☕
            </button>
          </nav>

          <div className="header__auth">
            {isAuthenticated && currentUser ? (
              <div className="header__profile" onClick={handleAuthToggle} title="클릭하여 로그아웃">
                <div className="header__profile-avatar">{currentUser.initial}</div>
                <span className="header__profile-name">{currentUser.name}</span>
              </div>
            ) : (
              <button className="header__auth-btn" onClick={handleAuthToggle}>
                <span>Slack으로 로그인</span>
              </button>
            )}
          </div>
        </header>

        {/* Status Bar */}
        <div className="status-bar">
          <div className="status-bar__item">
            <span className="status-bar__dot status-bar__dot--live"></span>
            <span>진행중인 팟</span>
            <span className="status-bar__count">{activePotsCount}</span>
          </div>
          <div className="status-bar__item">
            <span className="status-bar__dot status-bar__dot--total"></span>
            <span>총 참여인원</span>
            <span className="status-bar__count">{totalParticipantsCount}</span>
          </div>
        </div>

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

              const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline);
              const timeStr = pot.status === 'closed' ? '00:00' : formatTime(minutes, seconds);
              const isClosed = pot.status === 'closed';
              const isParticipating = isAuthenticated && currentUser && pot.participants.some(p => p.id === currentUser.id);

              let cardClasses = 'card';
              if (isUrgent && !isClosed) cardClasses += ' card--urgent';
              if (isClosed) cardClasses += ' card--closed';
              if (isParticipating && !isClosed) cardClasses += ' card--mine';

              const catLabel = r.category === 'lunch' ? '점심' : '카페';
              const catClass = r.category === 'lunch' ? 'card__category--lunch' : 'card__category--cafe';

              let statusClass = 'card__status--open';
              let statusText = '모집중';
              if (isClosed) { statusClass = 'card__status--closed'; statusText = '마감'; }
              else if (isUrgent) { statusClass = 'card__status--urgent'; statusText = '마감임박'; }

              const showCount = Math.min(3, pot.participants.length);

              return (
                <article
                  key={pot.id}
                  className={cardClasses}
                  style={{ animationDelay: `${index * 80}ms` }}
                  onClick={() => {
                    setSelectedPotId(pot.id);
                    setIsDetailOpen(true);
                  }}
                >
                  <div className="card__header">
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span className={`card__category ${catClass}`}>{catLabel}</span>
                      <span className={`card__status ${statusClass}`}>{statusText}</span>
                    </div>
                    <span style={{ fontSize: '1.8rem', lineHeight: 1 }}>{r.emoji}</span>
                  </div>
                  <h3 className="card__name">{r.name}</h3>
                  <p className="card__meta">최소주문 {r.minOrder.toLocaleString()}원 · {r.deliveryTime}</p>
                  
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
                      <span className="card__count"><span>{pot.participants.length}</span>명 참여</span>
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
                        if (!isAuthenticated) setIsAuthOpen(true);
                        else if (isParticipating) {
                          setSelectedPotId(pot.id);
                          setIsDetailOpen(true);
                        } else {
                          handleJoinPot(pot.id);
                        }
                      }}
                    >
                      {isClosed ? '마감' : !isAuthenticated ? '로그인 후 참여' : isParticipating ? '탑승중 ✓' : '탑승하기'}
                    </button>
                  </div>
                </article>
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
              setSearchTerm('');
              setCreateRestaurantId(null);
              setCreateMinutes(30);
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
          <div className="modal-overlay modal-overlay--active" onClick={() => setIsDetailOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h2 className="modal__title">팟 상세</h2>
                <button className="modal__close" onClick={() => setIsDetailOpen(false)}>✕</button>
              </div>
              <div className="modal__body">
                <div className="detail__restaurant">
                  <div className="detail__emoji">{selectedRestaurant.emoji}</div>
                  <div className="detail__name">{selectedRestaurant.name}</div>
                  <span className={`card__category ${selectedRestaurant.category === 'lunch' ? 'card__category--lunch' : 'card__category--cafe'}`} style={{ display: 'inline-block' }}>
                    {selectedRestaurant.category === 'lunch' ? '점심' : '카페'}
                  </span>
                </div>

                {(() => {
                  const { minutes, seconds, isUrgent } = getTimeRemaining(selectedPot.deadline);
                  const timeStr = selectedPot.status === 'closed' ? '00:00' : formatTime(minutes, seconds);
                  const isParticipating = isAuthenticated && currentUser && selectedPot.participants.some(p => p.id === currentUser.id);

                  return (
                    <>
                      <div className="detail__timer-section">
                        <div className={`detail__timer ${isUrgent && selectedPot.status !== 'closed' ? 'card__timer--urgent' : ''}`}>{timeStr}</div>
                        <div className="detail__timer-label">마감까지 남은 시간</div>
                      </div>

                      <div className="detail__info-grid">
                        <div className="detail__info-item">
                          <span className="detail__info-label">최소주문금액</span>
                          <span className="detail__info-value">{selectedRestaurant.minOrder.toLocaleString()}원</span>
                        </div>
                        <div className="detail__info-item">
                          <span className="detail__info-label">예상 배달시간</span>
                          <span className="detail__info-value">{selectedRestaurant.deliveryTime}</span>
                        </div>
                        <div className="detail__info-item">
                          <span className="detail__info-label">참여인원</span>
                          <span className="detail__info-value">{selectedPot.participants.length}명</span>
                        </div>
                        <div className="detail__info-item">
                          <span className="detail__info-label">상태</span>
                          <span className="detail__info-value">
                            {selectedPot.status === 'closed' ? '마감' : (isUrgent ? '⚠️ 마감임박' : '✅ 모집중')}
                          </span>
                        </div>
                      </div>

                      <div className="detail__menu-section">
                        <h4 className="detail__section-title">📋 대표 메뉴</h4>
                        <div className="detail__menu-list">
                          {selectedRestaurant.menus.map((m, idx) => (
                            <div key={idx} className="detail__menu-item">
                              <span className="detail__menu-name">{m.name}</span>
                              <span className="detail__menu-price">{m.price}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="detail__participants-section">
                        <h4 className="detail__section-title">👥 참여자 ({selectedPot.participants.length}명)</h4>
                        {!isAuthenticated ? (
                          <div className="detail__participant-hidden">🔒 로그인하면 참여자 정보를 확인할 수 있어요</div>
                        ) : isParticipating ? (
                          selectedPot.participants.map((p, i) => (
                            <div key={p.id} className="detail__participant">
                              <div className="detail__participant-avatar">{p.initial}</div>
                              <span className="detail__participant-name">{p.name}</span>
                              {i === 0 && <span className="detail__participant-badge">👑 방장</span>}
                            </div>
                          ))
                        ) : (
                          <div className="detail__participant-hidden">현재 {selectedPot.participants.length}명이 참여하고 있어요! 👀</div>
                        )}
                      </div>

                      <div className="modal__footer" style={{ padding: 0 }}>
                        {selectedPot.status === 'closed' ? (
                          <button className="create__submit-btn" disabled style={{ opacity: 0.4 }}>마감된 팟입니다</button>
                        ) : !isAuthenticated ? (
                          <button className="create__submit-btn" onClick={() => { setIsDetailOpen(false); setIsAuthOpen(true); }}>로그인하고 참여하기</button>
                        ) : isParticipating ? (
                          <button
                            className="create__submit-btn"
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}
                            onClick={() => handleLeavePot(selectedPot.id)}
                          >
                            탑승 취소하기
                          </button>
                        ) : (
                          <button className="create__submit-btn" onClick={() => handleJoinPot(selectedPot.id)}>탑승하기 🚀</button>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Create Modal */}
        {isCreateOpen && (
          <div className="modal-overlay modal-overlay--active" onClick={() => setIsCreateOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h2 className="modal__title">🍚 새 팟 만들기</h2>
                <button className="modal__close" onClick={() => setIsCreateOpen(false)}>✕</button>
              </div>
              <div className="modal__body">
                <div className="create__search-wrap">
                  <span className="create__search-icon">🔍</span>
                  <input
                    type="text"
                    className="create__search"
                    placeholder="매장 이름을 검색하세요..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>

                <div className="create__restaurant-list">
                  {RESTAURANTS.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase())).map(r => (
                    <div
                      key={r.id}
                      className={`create__restaurant-item ${createRestaurantId === r.id ? 'create__restaurant-item--selected' : ''}`}
                      onClick={() => setCreateRestaurantId(r.id)}
                    >
                      <span className="create__restaurant-emoji">{r.emoji}</span>
                      <div className="create__restaurant-info">
                        <span className="create__restaurant-name">{r.name}</span>
                        <span className="create__restaurant-meta">{r.category === 'lunch' ? '점심' : '카페'} · 최소 {r.minOrder.toLocaleString()}원 · {r.deliveryTime}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {createRestaurantId && (
                  <div className="create__time-section">
                    <label className="create__time-label">⏰ 마감 시간 설정</label>
                    <div className="create__time-options">
                      {[15, 20, 30, 45, 60].map(mins => (
                        <button
                          key={mins}
                          className={`create__time-option ${createMinutes === mins ? 'create__time-option--selected' : ''}`}
                          onClick={() => setCreateMinutes(mins)}
                        >
                          +{mins === 60 ? '1시간' : `${mins}분`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal__footer">
                <button
                  className="create__submit-btn"
                  disabled={!createRestaurantId}
                  onClick={handleCreateSubmit}
                >
                  팟 만들기 🚀
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Auth Modal */}
        {isAuthOpen && (
          <div className="modal-overlay modal-overlay--active" onClick={() => setIsAuthOpen(false)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal__header">
                <h2 className="modal__title">로그인</h2>
                <button className="modal__close" onClick={() => setIsAuthOpen(false)}>✕</button>
              </div>
              <div className="modal__body">
                <div className="auth__content">
                  <div className="auth__emoji">🍚</div>
                  <h3 className="auth__title">모여밥에 오신 걸 환영해요!</h3>
                  <p className="auth__desc">Slack 계정으로 로그인하면<br />팟에 참여하고 새 팟을 만들 수 있어요.</p>

                  <button className="auth__slack-btn" onClick={mockLogin}>
                    <svg className="auth__slack-icon" width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313z" fill="#E01E5A"/>
                      <path d="M8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312z" fill="#36C5F0"/>
                      <path d="M18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zm-1.27 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.163 0a2.528 2.528 0 0 1 2.523 2.522v6.312z" fill="#2EB67D"/>
                      <path d="M15.163 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.163 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zm0-1.27a2.527 2.527 0 0 1-2.52-2.523 2.527 2.527 0 0 1 2.52-2.52h6.315A2.528 2.528 0 0 1 24 15.163a2.528 2.528 0 0 1-2.522 2.523h-6.315z" fill="#ECB22E"/>
                    </svg>
                    Slack으로 계속하기
                  </button>
                  <div className="auth__divider">
                    <span>또는</span>
                  </div>
                  <p className="auth__guest-note">로그인 없이도 현재 진행중인 팟을 구경할 수 있어요 👀</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`toast toast--${toast.type}`}>
            {toast.message}
          </div>
        )}
      </div>
    </div>
  );
}
