// ===== Mock Data =====
const RESTAURANTS = [
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

const MOCK_USERS = [
  { id: 'u1', name: '김서연', initial: '서' },
  { id: 'u2', name: '이준호', initial: '준' },
  { id: 'u3', name: '박지민', initial: '민' },
  { id: 'u4', name: '최현우', initial: '현' },
  { id: 'u5', name: '정수아', initial: '수' },
  { id: 'u6', name: '한도윤', initial: '도' },
  { id: 'u7', name: '오지후', initial: '후' },
  { id: 'u8', name: '윤서윤', initial: '윤' },
];

const CURRENT_USER = { id: 'me', name: '나', initial: '나' };

// ===== State =====
let state = {
  isAuthenticated: false,
  currentUser: null,
  activeFilter: 'all',
  pots: [],
  selectedPot: null,
};

let createState = {
  selectedRestaurantId: null,
  selectedMinutes: 30,
};

// ===== Utilities =====
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function getRestaurant(id) {
  return RESTAURANTS.find(r => r.id === id);
}

// ===== Initialization =====
function init() {
  const now = new Date();

  state.pots = [
    {
      id: generateId(),
      restaurantId: 'bbq',
      deadline: new Date(now.getTime() + 7 * 60000),
      participants: [MOCK_USERS[0], MOCK_USERS[1], MOCK_USERS[2]],
      status: 'active'
    },
    {
      id: generateId(),
      restaurantId: 'starbucks',
      deadline: new Date(now.getTime() + 18 * 60000),
      participants: [MOCK_USERS[3], MOCK_USERS[4]],
      status: 'active'
    },
    {
      id: generateId(),
      restaurantId: 'dominos',
      deadline: new Date(now.getTime() + 2 * 60000),
      participants: [MOCK_USERS[5], MOCK_USERS[6], MOCK_USERS[7], MOCK_USERS[0], MOCK_USERS[1]],
      status: 'active'
    },
    {
      id: generateId(),
      restaurantId: 'mega',
      deadline: new Date(now.getTime() + 25 * 60000),
      participants: [MOCK_USERS[2]],
      status: 'active'
    },
    {
      id: generateId(),
      restaurantId: 'tteok',
      deadline: new Date(now.getTime() + 12 * 60000),
      participants: [MOCK_USERS[3], MOCK_USERS[4], MOCK_USERS[5], MOCK_USERS[6]],
      status: 'active'
    }
  ];

  bindEvents();
  startTimer();
  render();
  populateRestaurantList();
  populateTimeOptions();
}

// ===== Timer System =====
function startTimer() {
  setInterval(() => {
    let needsFullRender = false;

    state.pots.forEach(pot => {
      if (pot.status !== 'active') return;
      const remaining = getTimeRemaining(pot.deadline);

      if (remaining.isExpired) {
        const r = getRestaurant(pot.restaurantId);
        if (pot.participants.length >= 2) {
          pot.status = 'closed';
          showToast(`${r.name} 팟이 마감되었습니다! Slack에서 주문을 진행해주세요 🎉`, 'success');
        } else {
          showToast(`${r.name} 팟이 인원 미달로 종료되었습니다`, 'error');
          state.pots = state.pots.filter(p => p.id !== pot.id);
        }
        needsFullRender = true;

        if (state.selectedPot && state.selectedPot.id === pot.id) {
          closeAllModals();
        }
      }
    });

    if (needsFullRender) {
      render();
    } else {
      updateTimersDOM();
    }
  }, 1000);
}

function getTimeRemaining(deadline) {
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
}

function formatTime(m, s) {
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updateTimersDOM() {
  state.pots.forEach(pot => {
    if (pot.status !== 'active') return;
    const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline);
    const timeStr = formatTime(minutes, seconds);

    // Update card timer
    const card = document.querySelector(`.card[data-pot-id="${pot.id}"]`);
    if (card) {
      const timerEl = card.querySelector('.card__timer');
      if (timerEl) {
        timerEl.textContent = timeStr;
        timerEl.classList.toggle('card__timer--urgent', isUrgent);
      }
      card.classList.toggle('card--urgent', isUrgent);

      const statusEl = card.querySelector('.card__status');
      if (statusEl) {
        if (isUrgent) {
          statusEl.className = 'card__status card__status--urgent';
          statusEl.textContent = '마감임박';
        } else {
          statusEl.className = 'card__status card__status--open';
          statusEl.textContent = '모집중';
        }
      }
    }

    // Update detail modal timer if open
    if (state.selectedPot && state.selectedPot.id === pot.id) {
      const detailTimer = document.querySelector('.detail__timer');
      if (detailTimer) {
        detailTimer.textContent = timeStr;
        detailTimer.classList.toggle('card__timer--urgent', isUrgent);
      }
    }
  });
}

// ===== Rendering =====
function render() {
  renderStatusBar();
  renderGrid();
  renderAuthArea();
}

function renderStatusBar() {
  const activePots = state.pots.filter(p => p.status === 'active');
  const totalP = state.pots.reduce((sum, p) => sum + p.participants.length, 0);

  const liveEl = document.getElementById('liveCount');
  const totalEl = document.getElementById('totalParticipants');
  if (liveEl) liveEl.textContent = activePots.length;
  if (totalEl) totalEl.textContent = totalP;
}

function renderAuthArea() {
  const authArea = document.getElementById('authArea');
  if (!authArea) return;

  if (state.isAuthenticated) {
    authArea.innerHTML = `
      <div class="header__profile" onclick="logout()" title="클릭하여 로그아웃">
        <div class="header__profile-avatar">${state.currentUser.initial}</div>
        <span class="header__profile-name">${state.currentUser.name}</span>
      </div>
    `;
  } else {
    authArea.innerHTML = `
      <button class="header__auth-btn" id="authBtn" onclick="openAuthModal()">
        <span>Slack으로 로그인</span>
      </button>
    `;
  }
}

function renderGrid() {
  const grid = document.getElementById('potGrid');
  const emptyState = document.getElementById('emptyState');
  if (!grid) return;

  let filtered = state.pots;
  if (state.activeFilter !== 'all') {
    filtered = state.pots.filter(p => {
      const r = getRestaurant(p.restaurantId);
      return r && r.category === state.activeFilter;
    });
  }

  // Sort: active first (urgent/soonest deadline first), then closed
  filtered.sort((a, b) => {
    if (a.status === 'closed' && b.status !== 'closed') return 1;
    if (a.status !== 'closed' && b.status === 'closed') return -1;
    return a.deadline - b.deadline;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    if (emptyState) emptyState.style.display = '';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  grid.innerHTML = filtered.map((pot, i) => renderCard(pot, i)).join('');
}

function renderCard(pot, index) {
  const r = getRestaurant(pot.restaurantId);
  const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline);
  const timeStr = pot.status === 'closed' ? '00:00' : formatTime(minutes, seconds);
  const isClosed = pot.status === 'closed';
  const isParticipating = state.isAuthenticated && pot.participants.some(p => p.id === state.currentUser.id);

  // Card modifier classes
  let cardClasses = 'card';
  if (isUrgent && !isClosed) cardClasses += ' card--urgent';
  if (isClosed) cardClasses += ' card--closed';
  if (isParticipating && !isClosed) cardClasses += ' card--mine';

  // Category
  const catLabel = r.category === 'lunch' ? '점심' : '카페';
  const catClass = r.category === 'lunch' ? 'card__category--lunch' : 'card__category--cafe';

  // Status
  let statusClass, statusText;
  if (isClosed) { statusClass = 'card__status--closed'; statusText = '마감'; }
  else if (isUrgent) { statusClass = 'card__status--urgent'; statusText = '마감임박'; }
  else { statusClass = 'card__status--open'; statusText = '모집중'; }

  // Avatars (show up to 3)
  let avatarsHtml = '';
  const showCount = Math.min(3, pot.participants.length);
  for (let i = 0; i < showCount; i++) {
    avatarsHtml += `<div class="card__avatar">${pot.participants[i].initial}</div>`;
  }
  if (pot.participants.length > 3) {
    avatarsHtml += `<div class="card__avatar card__avatar--more">+${pot.participants.length - 3}</div>`;
  }

  // Join button
  let btnClass, btnText, btnAction;
  if (isClosed) {
    btnClass = 'card__join-btn--closed'; btnText = '마감'; btnAction = 'closed';
  } else if (!state.isAuthenticated) {
    btnClass = 'card__join-btn--login'; btnText = '로그인 후 참여'; btnAction = 'login';
  } else if (isParticipating) {
    btnClass = 'card__join-btn--joined'; btnText = '탑승중 ✓'; btnAction = 'leave';
  } else {
    btnClass = 'card__join-btn--join'; btnText = '탑승하기'; btnAction = 'join';
  }

  return `
    <article class="${cardClasses}" data-pot-id="${pot.id}" style="animation: fadeInUp 0.5s ease ${index * 80}ms both">
      <div class="card__header">
        <div style="display:flex;gap:8px;align-items:center">
          <span class="card__category ${catClass}">${catLabel}</span>
          <span class="card__status ${statusClass}">${statusText}</span>
        </div>
        <span style="font-size:1.8rem;line-height:1">${r.emoji}</span>
      </div>
      <h3 class="card__name">${r.name}</h3>
      <p class="card__meta">최소주문 ${r.minOrder.toLocaleString()}원 · ${r.deliveryTime}</p>
      <div class="card__timer-row">
        <span class="card__timer-icon">⏱</span>
        <span>마감까지</span>
        <span class="card__timer ${isUrgent && !isClosed ? 'card__timer--urgent' : ''}">${timeStr}</span>
      </div>
      <div class="card__footer">
        <div class="card__participants">
          <div class="card__avatars">${avatarsHtml}</div>
          <span class="card__count"><span>${pot.participants.length}</span>명 참여</span>
        </div>
        <button class="card__join-btn ${btnClass}" data-action="${btnAction}">${btnText}</button>
      </div>
    </article>
  `;
}

// ===== Modal System =====
function openModal(overlayId) {
  const el = document.getElementById(overlayId);
  if (el) el.classList.add('modal-overlay--active');
}

function closeModal(overlayId) {
  const el = document.getElementById(overlayId);
  if (el) el.classList.remove('modal-overlay--active');
  if (overlayId === 'detailModalOverlay') state.selectedPot = null;
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(el => el.classList.remove('modal-overlay--active'));
  state.selectedPot = null;
}

function handleOverlayClick(event, overlayId) {
  if (event.target === event.currentTarget) closeModal(overlayId);
}

// ===== Detail Modal =====
function openDetailModal(potId) {
  const pot = state.pots.find(p => p.id === potId);
  if (!pot) return;
  state.selectedPot = pot;

  const r = getRestaurant(pot.restaurantId);
  const { minutes, seconds, isUrgent } = getTimeRemaining(pot.deadline);
  const timeStr = pot.status === 'closed' ? '00:00' : formatTime(minutes, seconds);
  const isParticipating = state.isAuthenticated && pot.participants.some(p => p.id === state.currentUser.id);
  const catLabel = r.category === 'lunch' ? '점심' : '카페';
  const catClass = r.category === 'lunch' ? 'card__category--lunch' : 'card__category--cafe';

  // Menu list
  const menuHtml = r.menus.map(m => `
    <div class="detail__menu-item">
      <span class="detail__menu-name">${m.name}</span>
      <span class="detail__menu-price">${m.price}</span>
    </div>
  `).join('');

  // Participant section
  let participantsHtml;
  if (!state.isAuthenticated) {
    participantsHtml = `<div class="detail__participant-hidden">🔒 로그인하면 참여자 정보를 확인할 수 있어요</div>`;
  } else if (isParticipating) {
    participantsHtml = pot.participants.map((p, i) => `
      <div class="detail__participant">
        <div class="detail__participant-avatar">${p.initial}</div>
        <span class="detail__participant-name">${p.name}</span>
        ${i === 0 ? '<span class="detail__participant-badge">👑 방장</span>' : ''}
      </div>
    `).join('');
  } else {
    participantsHtml = `<div class="detail__participant-hidden">현재 ${pot.participants.length}명이 참여하고 있어요! 👀</div>`;
  }

  // Populate body
  const body = document.getElementById('detailModalBody');
  body.innerHTML = `
    <div class="detail__restaurant">
      <div class="detail__emoji">${r.emoji}</div>
      <div class="detail__name">${r.name}</div>
      <span class="card__category ${catClass}" style="display:inline-block">${catLabel}</span>
    </div>
    <div class="detail__timer-section">
      <div class="detail__timer ${isUrgent && pot.status !== 'closed' ? 'card__timer--urgent' : ''}">${timeStr}</div>
      <div class="detail__timer-label">마감까지 남은 시간</div>
    </div>
    <div class="detail__info-grid">
      <div class="detail__info-item">
        <span class="detail__info-label">최소주문금액</span>
        <span class="detail__info-value">${r.minOrder.toLocaleString()}원</span>
      </div>
      <div class="detail__info-item">
        <span class="detail__info-label">예상 배달시간</span>
        <span class="detail__info-value">${r.deliveryTime}</span>
      </div>
      <div class="detail__info-item">
        <span class="detail__info-label">참여인원</span>
        <span class="detail__info-value">${pot.participants.length}명</span>
      </div>
      <div class="detail__info-item">
        <span class="detail__info-label">상태</span>
        <span class="detail__info-value">${pot.status === 'closed' ? '마감' : (isUrgent ? '⚠️ 마감임박' : '✅ 모집중')}</span>
      </div>
    </div>
    <div class="detail__menu-section">
      <h4 class="detail__section-title">📋 대표 메뉴</h4>
      <div class="detail__menu-list">${menuHtml}</div>
    </div>
    <div class="detail__participants-section">
      <h4 class="detail__section-title">👥 참여자 (${pot.participants.length}명)</h4>
      ${participantsHtml}
    </div>
    ${pot.status === 'closed' ? `
      <div style="text-align:center;padding:16px;background:rgba(34,197,94,0.08);border-radius:12px;margin-top:8px">
        <p style="color:#22C55E;font-weight:600;margin-bottom:4px">🎉 마감 완료!</p>
        <p style="color:#94A3B8;font-size:0.85rem">Slack 채널에서 세부 주문을 진행해주세요</p>
      </div>
    ` : ''}
  `;

  // Populate footer
  const footer = document.getElementById('detailModalFooter');
  if (pot.status === 'closed') {
    footer.innerHTML = `<button class="create__submit-btn" disabled style="opacity:0.4">마감된 팟입니다</button>`;
  } else if (!state.isAuthenticated) {
    footer.innerHTML = `<button class="create__submit-btn" onclick="closeModal('detailModalOverlay'); setTimeout(openAuthModal, 200)">로그인하고 참여하기</button>`;
  } else if (isParticipating) {
    footer.innerHTML = `<button class="create__submit-btn" style="background:rgba(239,68,68,0.1);color:#ef4444;border:1px solid rgba(239,68,68,0.3)" onclick="leavePot('${pot.id}')">탑승 취소하기</button>`;
  } else {
    footer.innerHTML = `<button class="create__submit-btn" onclick="joinPot('${pot.id}')">탑승하기 🚀</button>`;
  }

  openModal('detailModalOverlay');
}

// ===== Create Modal =====
function populateRestaurantList(filter) {
  const list = document.getElementById('restaurantList');
  if (!list) return;

  const term = (filter || '').toLowerCase();
  const filtered = term
    ? RESTAURANTS.filter(r => r.name.toLowerCase().includes(term))
    : RESTAURANTS;

  if (filtered.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--text-muted);padding:24px;font-size:0.9rem">검색 결과가 없습니다 😢</div>';
    return;
  }

  list.innerHTML = filtered.map(r => {
    const isSelected = createState.selectedRestaurantId === r.id;
    return `
      <div class="create__restaurant-item ${isSelected ? 'create__restaurant-item--selected' : ''}" data-restaurant-id="${r.id}">
        <span class="create__restaurant-emoji">${r.emoji}</span>
        <div class="create__restaurant-info">
          <span class="create__restaurant-name">${r.name}</span>
          <span class="create__restaurant-meta">${r.category === 'lunch' ? '점심' : '카페'} · 최소 ${r.minOrder.toLocaleString()}원 · ${r.deliveryTime}</span>
        </div>
      </div>
    `;
  }).join('');
}

function populateTimeOptions() {
  const container = document.getElementById('timeOptions');
  if (!container) return;

  const options = [
    { mins: 15, label: '+15분' },
    { mins: 20, label: '+20분' },
    { mins: 30, label: '+30분' },
    { mins: 45, label: '+45분' },
    { mins: 60, label: '+1시간' },
  ];

  container.innerHTML = options.map(o => `
    <button class="create__time-option ${createState.selectedMinutes === o.mins ? 'create__time-option--selected' : ''}" data-mins="${o.mins}">${o.label}</button>
  `).join('');
}

function handleFabClick() {
  if (!state.isAuthenticated) {
    openAuthModal();
    return;
  }

  // Reset create state
  createState.selectedRestaurantId = null;
  createState.selectedMinutes = 30;

  const searchInput = document.getElementById('restaurantSearch');
  if (searchInput) searchInput.value = '';

  const timeSection = document.getElementById('timeSection');
  if (timeSection) timeSection.style.display = 'none';

  const submitBtn = document.getElementById('createSubmitBtn');
  if (submitBtn) submitBtn.disabled = true;

  populateRestaurantList();
  populateTimeOptions();
  openModal('createModalOverlay');
}

function handleCreateSubmit() {
  if (!createState.selectedRestaurantId) return;

  const r = getRestaurant(createState.selectedRestaurantId);
  if (!r) return;

  const now = new Date();
  const newPot = {
    id: generateId(),
    restaurantId: createState.selectedRestaurantId,
    deadline: new Date(now.getTime() + createState.selectedMinutes * 60000),
    participants: [state.currentUser],
    status: 'active'
  };

  state.pots.push(newPot);
  closeModal('createModalOverlay');

  // Switch filter if needed
  if (state.activeFilter !== 'all' && state.activeFilter !== r.category) {
    state.activeFilter = 'all';
    document.querySelectorAll('.header__tab').forEach(t => {
      t.classList.toggle('header__tab--active', t.dataset.filter === 'all');
    });
  }

  render();
  showToast(`${r.name} 팟이 생성되었습니다! ✨`, 'success');
  triggerConfetti();
}

// ===== Auth =====
function openAuthModal() {
  openModal('authModalOverlay');
}

function mockLogin() {
  state.isAuthenticated = true;
  state.currentUser = { ...CURRENT_USER };
  closeAllModals();
  render();
  showToast(`환영합니다, ${state.currentUser.name}님! 🎉`, 'success');
}

function logout() {
  // Remove user from all active pots
  state.pots.forEach(pot => {
    if (pot.status === 'active') {
      pot.participants = pot.participants.filter(p => p.id !== state.currentUser.id);
    }
  });
  // Remove empty pots
  state.pots = state.pots.filter(p => p.participants.length > 0);

  state.isAuthenticated = false;
  state.currentUser = null;
  closeAllModals();
  render();
  showToast('로그아웃 되었습니다.', 'success');
}

// ===== Pot Actions =====
function joinPot(potId) {
  if (!state.isAuthenticated) {
    openAuthModal();
    return;
  }

  const pot = state.pots.find(p => p.id === potId);
  if (!pot || pot.status !== 'active') return;
  if (pot.participants.some(p => p.id === state.currentUser.id)) return;

  pot.participants.push(state.currentUser);
  const r = getRestaurant(pot.restaurantId);

  render();

  // Re-open detail modal if it was open
  if (state.selectedPot && state.selectedPot.id === pot.id) {
    openDetailModal(pot.id);
  }

  showToast(`${r.name}에 탑승했어요! 🚀`, 'success');
  triggerConfetti();
}

function leavePot(potId) {
  const pot = state.pots.find(p => p.id === potId);
  if (!pot || pot.status !== 'active') return;

  pot.participants = pot.participants.filter(p => p.id !== state.currentUser.id);
  const r = getRestaurant(pot.restaurantId);

  // If pot is now empty, remove it
  if (pot.participants.length === 0) {
    state.pots = state.pots.filter(p => p.id !== pot.id);
    closeAllModals();
    render();
    showToast(`${r.name} 팟이 종료되었습니다.`, 'error');
    return;
  }

  render();

  // Re-open detail modal if it was open
  if (state.selectedPot && state.selectedPot.id === pot.id) {
    openDetailModal(pot.id);
  }

  showToast(`${r.name} 탑승을 취소했습니다.`, 'error');
}

// ===== Toast System =====
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.textContent = message;
  toast.style.transition = 'all 0.3s ease';
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translate(-50%, 20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== Confetti Effect =====
function triggerConfetti() {
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
}

// ===== Event Binding =====
function bindEvents() {
  // Category tab clicks
  document.querySelectorAll('.header__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.header__tab').forEach(t => t.classList.remove('header__tab--active'));
      tab.classList.add('header__tab--active');
      state.activeFilter = tab.dataset.filter;
      renderGrid();
    });
  });

  // Grid event delegation (card clicks & join button clicks)
  const grid = document.getElementById('potGrid');
  if (grid) {
    grid.addEventListener('click', (e) => {
      // Join button click
      const btn = e.target.closest('.card__join-btn');
      if (btn) {
        e.stopPropagation();
        const card = btn.closest('.card');
        const potId = card.dataset.potId;
        const action = btn.dataset.action;

        if (action === 'join') {
          joinPot(potId);
        } else if (action === 'login') {
          openAuthModal();
        } else if (action === 'leave') {
          openDetailModal(potId);
        }
        return;
      }

      // Card click → open detail
      const card = e.target.closest('.card');
      if (card && card.dataset.potId) {
        openDetailModal(card.dataset.potId);
      }
    });
  }

  // Restaurant search input
  const searchInput = document.getElementById('restaurantSearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      populateRestaurantList(e.target.value);
    });
  }

  // Restaurant list delegation
  const restList = document.getElementById('restaurantList');
  if (restList) {
    restList.addEventListener('click', (e) => {
      const item = e.target.closest('.create__restaurant-item');
      if (!item) return;

      createState.selectedRestaurantId = item.dataset.restaurantId;
      populateRestaurantList(document.getElementById('restaurantSearch')?.value || '');

      // Show time section & enable submit
      const timeSection = document.getElementById('timeSection');
      if (timeSection) timeSection.style.display = '';
      const submitBtn = document.getElementById('createSubmitBtn');
      if (submitBtn) submitBtn.disabled = false;
    });
  }

  // Time options delegation
  const timeOpts = document.getElementById('timeOptions');
  if (timeOpts) {
    timeOpts.addEventListener('click', (e) => {
      const opt = e.target.closest('.create__time-option');
      if (!opt) return;

      createState.selectedMinutes = parseInt(opt.dataset.mins, 10);
      populateTimeOptions();
    });
  }

  // Escape key closes modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllModals();
  });
}

// ===== Bootstrap =====
document.addEventListener('DOMContentLoaded', init);
