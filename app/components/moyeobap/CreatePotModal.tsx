import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { findExactRestaurant, findRestaurantSuggestions } from '../../lib/restaurant-matching';
import type { Restaurant, SerializedPot } from '../../types/moyeobap';

interface CreatePotFormProps {
  restaurants: Restaurant[];
  pots: SerializedPot[];
  initialRestaurantId?: string | null;
  onCreateCustomRestaurant: (input: {
    name: string;
    category: 'lunch' | 'cafe' | 'other';
    saveToDirectory?: boolean;
  }) => Promise<string | null>;
  onSubmit: (restaurantId: string, minutes: number, maxParticipants: number | null) => Promise<string | null>;
}

// 모집 마감까지 걸어둘 수 있는 시간(분). 1시간이 상한이면 미리 열어두는 팟을
// 만들 수 없다는 의견이 있어 2·3시간을 더했다.
const DEADLINE_OPTIONS = [15, 20, 30, 45, 60, 120, 180];
const MAX_DEADLINE_MINUTES = 24 * 60;

// data/DATA_GUIDE.md의 소분류 14종 순서와 맞춰뒀습니다. 여기 없는 값(직접 추가한 매장 등)은 뒤로 밀립니다.
const SUB_CATEGORY_ORDER = [
  '분식', '중식', '패스트푸드', '치킨', '한식', '피자', '찜·탕', '돈까스·회', '양식', '아시안', '고기', '족발·보쌈', '도시락', '카페·디저트',
];

function groupBySubCategory(list: Restaurant[]) {
  const groups = new Map<string, Restaurant[]>();
  for (const r of list) {
    const key = r.subCategory ?? '기타';
    const bucket = groups.get(key) ?? [];
    bucket.push(r);
    groups.set(key, bucket);
  }
  const orderedKeys = [
    ...SUB_CATEGORY_ORDER.filter(key => groups.has(key)),
    ...[...groups.keys()].filter(key => !SUB_CATEGORY_ORDER.includes(key)),
  ];
  return orderedKeys.map(key => ({ key, items: groups.get(key)! }));
}

function formatRemainingTime(deadline: string) {
  const remainingMinutes = Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 60_000));
  if (remainingMinutes < 60) return `${remainingMinutes}분`;

  const hours = Math.floor(remainingMinutes / 60);
  const minutes = remainingMinutes % 60;
  return minutes > 0 ? `${hours}시간 ${minutes}분` : `${hours}시간`;
}

export function CreatePotForm({
  restaurants,
  pots,
  initialRestaurantId,
  onCreateCustomRestaurant,
  onSubmit,
}: CreatePotFormProps) {
  const initialRest = useMemo(
    () => (initialRestaurantId ? restaurants.find((r) => r.id === initialRestaurantId) : undefined),
    [initialRestaurantId, restaurants],
  );

  const [mode, setMode] = useState<'list' | 'custom'>('list');
  const [categoryFilter, setCategoryFilter] = useState<'lunch' | 'cafe' | 'other'>(
    initialRest?.category ?? 'lunch',
  );
  const [subCategoryFilter, setSubCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(
    initialRestaurantId ?? null,
  );

  useEffect(() => {
    if (initialRestaurantId) {
      const timer = window.setTimeout(() => {
        const el = document.getElementById(`restaurant-item-${initialRestaurantId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
      return () => window.clearTimeout(timer);
    }
  }, [initialRestaurantId]);
  const [deadlineChoice, setDeadlineChoice] = useState<number | 'custom'>(30);
  const [customMinutes, setCustomMinutes] = useState('90');
  const [hasParticipantLimit, setHasParticipantLimit] = useState(false);
  const [participantLimit, setParticipantLimit] = useState('4');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<'lunch' | 'cafe' | 'other'>('lunch');
  const [saveToDirectory, setSaveToDirectory] = useState(false);
  const [selectedCustomRestaurantId, setSelectedCustomRestaurantId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryRestaurants = useMemo(
    () => restaurants.filter((restaurant) => restaurant.category === categoryFilter),
    [categoryFilter, restaurants],
  );

  const subCategoryOptions = useMemo(() => {
    const available = new Set(
      categoryRestaurants.map((restaurant) => restaurant.subCategory ?? '기타'),
    );
    return [
      ...SUB_CATEGORY_ORDER.filter((subCategory) => available.has(subCategory)),
      ...[...available].filter((subCategory) => !SUB_CATEGORY_ORDER.includes(subCategory)),
    ];
  }, [categoryRestaurants]);

  const groupedRestaurants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('ko');
    const filtered = categoryRestaurants.filter((restaurant) => {
      const matchesSubCategory = subCategoryFilter === 'all'
        || (restaurant.subCategory ?? '기타') === subCategoryFilter;
      const matchesSearch = `${restaurant.name} ${restaurant.subCategory ?? ''}`
        .toLocaleLowerCase('ko')
        .includes(normalizedSearch);
      return matchesSubCategory && matchesSearch;
    });
    return groupBySubCategory(filtered);
  }, [categoryRestaurants, searchTerm, subCategoryFilter]);

  const activePotsByRestaurant = useMemo(() => {
    const grouped = new Map<string, SerializedPot[]>();
    for (const pot of pots) {
      if (pot.status !== 'active') continue;
      const restaurantPots = grouped.get(pot.restaurantId) ?? [];
      restaurantPots.push(pot);
      grouped.set(pot.restaurantId, restaurantPots);
    }
    return grouped;
  }, [pots]);

  const customSuggestions = useMemo(
    () => findRestaurantSuggestions(restaurants, customName, customCategory),
    [customCategory, customName, restaurants],
  );
  const exactCustomMatch = useMemo(
    () => findExactRestaurant(restaurants, customName, customCategory),
    [customCategory, customName, restaurants],
  );
  const effectiveRestaurantId = mode === 'list'
    ? selectedRestaurantId
    : selectedCustomRestaurantId ?? exactCustomMatch?.id ?? null;
  const selectedActivePots = useMemo(
    () => (effectiveRestaurantId ? activePotsByRestaurant.get(effectiveRestaurantId) ?? [] : [])
      .filter((pot) => pot.maxParticipants === null || pot.participantCount < pot.maxParticipants)
      .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime()),
    [activePotsByRestaurant, effectiveRestaurantId],
  );

  const selectedMinutes = deadlineChoice === 'custom' ? Number(customMinutes) : deadlineChoice;
  const selectedCap = hasParticipantLimit ? Number(participantLimit) : null;
  const hasValidRestaurant = mode === 'list'
    ? Boolean(selectedRestaurantId)
    : Boolean(effectiveRestaurantId || customName.trim().length > 0);
  const hasValidDeadline = Number.isInteger(selectedMinutes)
    && selectedMinutes >= 5
    && selectedMinutes <= MAX_DEADLINE_MINUTES;
  const hasValidCap = selectedCap === null
    || (Number.isInteger(selectedCap) && selectedCap >= 2 && selectedCap <= 50);
  const canSubmit = hasValidRestaurant && hasValidDeadline && hasValidCap;

  function handleCategoryChange(category: 'lunch' | 'cafe' | 'other') {
    setCategoryFilter(category);
    setSubCategoryFilter('all');
    const selectedRestaurant = restaurants.find((restaurant) => restaurant.id === selectedRestaurantId);
    if (selectedRestaurant && selectedRestaurant.category !== category) {
      setSelectedRestaurantId(null);
    }
  }

  function handleCustomNameChange(name: string) {
    setCustomName(name);
    setSelectedCustomRestaurantId(null);
  }

  function handleCustomCategoryChange(category: 'lunch' | 'cafe' | 'other') {
    setCustomCategory(category);
    setSelectedCustomRestaurantId(null);
  }

  function handleSuggestionSelect(restaurant: Restaurant) {
    setSelectedCustomRestaurantId(restaurant.id);
    setCustomName(restaurant.name);
    setError(null);
  }

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      let restaurantId = effectiveRestaurantId;
      if (mode === 'custom' && !restaurantId) {
        if (customSuggestions.length > 0 && !window.confirm(`추천된 매장과 다른 곳이 맞나요?\n\n“${customName.trim()}”을 새 매장으로 추가합니다.`)) {
          return;
        }
        restaurantId = await onCreateCustomRestaurant({
          name: customName.trim(),
          category: customCategory,
          saveToDirectory,
        });
        if (!restaurantId) {
          setError('매장을 추가하지 못했어요. 다시 시도해주세요.');
          return;
        }
      }

      if (!restaurantId) return;
      const submitError = await onSubmit(restaurantId, selectedMinutes, selectedCap);
      if (submitError) setError(submitError);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="create-page__form" aria-label="새 팟 정보">
          <div className="create__mode-tabs">
            <button
              type="button"
              className={`create__mode-tab ${mode === 'list' ? 'create__mode-tab--active' : ''}`}
              onClick={() => {
                setMode('list');
                setError(null);
              }}
            >
              목록에서 선택
            </button>
            <button
              type="button"
              className={`create__mode-tab ${mode === 'custom' ? 'create__mode-tab--active' : ''}`}
              onClick={() => {
                setMode('custom');
                setError(null);
              }}
            >
              직접 입력
            </button>
          </div>

          {mode === 'list' ? (
            <>
              <div aria-label="매장 종류" className="create__category-tabs" role="group">
                {([
                  ['lunch', '🍱 점심'],
                  ['cafe', '☕ 카페'],
                  ['other', '📦 기타'],
                ] as const).map(([category, label]) => (
                  <button
                    aria-pressed={categoryFilter === category}
                    className={`create__category-tab ${categoryFilter === category ? 'create__category-tab--active' : ''}`}
                    key={category}
                    onClick={() => handleCategoryChange(category)}
                    type="button"
                  >
                    <span>{label}</span>
                    <small>{restaurants.filter((restaurant) => restaurant.category === category).length}</small>
                  </button>
                ))}
              </div>

              <div aria-label="매장 세부 카테고리" className="create__subcategory-tabs">
                <button
                  aria-pressed={subCategoryFilter === 'all'}
                  className={`create__subcategory-tab ${subCategoryFilter === 'all' ? 'create__subcategory-tab--active' : ''}`}
                  onClick={() => setSubCategoryFilter('all')}
                  type="button"
                >
                  전체
                </button>
                {subCategoryOptions.map((subCategory) => (
                  <button
                    aria-pressed={subCategoryFilter === subCategory}
                    className={`create__subcategory-tab ${subCategoryFilter === subCategory ? 'create__subcategory-tab--active' : ''}`}
                    key={subCategory}
                    onClick={() => setSubCategoryFilter(subCategory)}
                    type="button"
                  >
                    {subCategory}
                  </button>
                ))}
              </div>

              <div className="create__search-wrap">
                <span className="create__search-icon">🔍</span>
                <input
                  type="text"
                  className="create__search"
                  placeholder={`${categoryFilter === 'lunch' ? '점심' : '카페'} 매장을 검색하세요...`}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="create__restaurant-list">
                {groupedRestaurants.map(group => (
                  <div key={group.key} className="create__restaurant-group">
                    <div className="create__restaurant-group-heading">
                      <p className="create__restaurant-group-label">{group.key}</p>
                      <span>{group.items.length}곳</span>
                    </div>
                    <div className="create__restaurant-gallery">
                      {group.items.map(r => {
                        const activePotCount = activePotsByRestaurant.get(r.id)?.length ?? 0;
                        return (
                          <button
                            id={`restaurant-item-${r.id}`}
                            aria-pressed={selectedRestaurantId === r.id}
                            key={r.id}
                            className={`create__restaurant-item ${selectedRestaurantId === r.id ? 'create__restaurant-item--selected' : ''}`}
                            onClick={() => setSelectedRestaurantId(r.id)}
                            type="button"
                          >
                            <span className="create__restaurant-emoji">{r.emoji}</span>
                            <span className="create__restaurant-info">
                              <span className="create__restaurant-name">{r.name}</span>
                              <span className="create__restaurant-meta">
                                {r.minOrder > 0 ? `최소 ${r.minOrder.toLocaleString()}원` : '최소주문 정보 없음'} · {r.deliveryTime}
                              </span>
                              {activePotCount > 0 && (
                                <span className="create__restaurant-live">모집 중 {activePotCount}</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                {groupedRestaurants.length === 0 && (
                  <p className="create__empty-result">검색 결과가 없어요.</p>
                )}
              </div>
            </>
          ) : (
            <div className="create__custom-form">
              <label className="create__time-label">매장 이름</label>
              <input
                type="text"
                className="create__search"
                placeholder="예: 배곧 이름없는 김밥집"
                value={customName}
                onChange={e => handleCustomNameChange(e.target.value)}
              />
              <label className="create__time-label create__time-label--spaced">종류</label>
              <div className="create__time-options">
                <button
                  type="button"
                  className={`create__time-option ${customCategory === 'lunch' ? 'create__time-option--selected' : ''}`}
                  onClick={() => handleCustomCategoryChange('lunch')}
                >
                  점심
                </button>
                <button
                  type="button"
                  className={`create__time-option ${customCategory === 'cafe' ? 'create__time-option--selected' : ''}`}
                  onClick={() => handleCustomCategoryChange('cafe')}
                >
                  카페
                </button>
                <button
                  type="button"
                  className={`create__time-option ${customCategory === 'other' ? 'create__time-option--selected' : ''}`}
                  onClick={() => handleCustomCategoryChange('other')}
                >
                  기타
                </button>
              </div>

              <div style={{ marginTop: '16px', padding: '12px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={saveToDirectory}
                    onChange={(e) => setSaveToDirectory(e.target.checked)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                    매장 목록에 등록하여 다음에도 계속 사용하기
                  </span>
                </label>
                <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '4px', paddingLeft: '26px' }}>
                  {saveToDirectory
                    ? '이 매장은 목록에 저장되어 추후 다른 팟 생성 시에도 노출됩니다.'
                    : '기본값: 이번 모집에만 사용하는 1회성 팟으로 생성됩니다.'}
                </small>
              </div>
              {customSuggestions.length > 0 && (
                <section className="create__restaurant-suggestions" aria-live="polite">
                  <div className="create__restaurant-suggestions-heading">
                    <strong>{exactCustomMatch ? '이미 등록된 매장이에요' : '비슷한 매장이 있어요'}</strong>
                    <p>{exactCustomMatch ? '기존 매장을 사용해 팟을 만들어요.' : '찾던 매장이 있다면 선택해주세요.'}</p>
                  </div>
                  <div className="create__restaurant-suggestion-list">
                    {customSuggestions.map((restaurant) => {
                      const selected = effectiveRestaurantId === restaurant.id;
                      return (
                        <button
                          aria-pressed={selected}
                          className={selected ? 'create__restaurant-suggestion--selected' : ''}
                          key={restaurant.id}
                          onClick={() => handleSuggestionSelect(restaurant)}
                          type="button"
                        >
                          <span className="create__restaurant-suggestion-info">
                            <span aria-hidden="true">{restaurant.emoji}</span>
                            <span>
                              <strong>{restaurant.name}</strong>
                              <small>{restaurant.subCategory ?? (restaurant.category === 'lunch' ? '점심' : restaurant.category === 'other' ? '기타' : '카페')}</small>
                            </span>
                          </span>
                          <span>{selected ? '선택됨' : '이 매장 선택'}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
              <p className="create__custom-note">
                {effectiveRestaurantId
                  ? '선택한 기존 매장으로 팟을 만들어요.'
                  : '목록에 없는 매장도 이름만 입력해 팟을 만들 수 있어요.'}
              </p>
            </div>
          )}

          {selectedActivePots.length > 0 && (
            <aside className="create__existing-pots">
              <div>
                <strong>이 매장에서 모집 중인 팟이 있어요</strong>
                <p>새로 만들기 전에 참여할 수 있는 팟을 확인해보세요.</p>
              </div>
              <div className="create__existing-pot-list">
                {selectedActivePots.map((pot) => (
                  <Link href={`/pots/${encodeURIComponent(pot.id)}`} key={pot.id}>
                    <span>
                      <strong>마감까지 {formatRemainingTime(pot.deadline)}</strong>
                      <small>{pot.participantCount}명 참여{pot.maxParticipants ? ` · 최대 ${pot.maxParticipants}명` : ''}</small>
                    </span>
                    <b>{pot.isParticipating ? '팟 보기' : '기존 팟 참여하기'} →</b>
                  </Link>
                ))}
              </div>
              <p className="create__existing-pots-footer">다른 시간으로 모집하려면 아래에서 마감 시간을 선택하세요.</p>
            </aside>
          )}

          {(mode === 'custom' || selectedRestaurantId) && (
            <>
              <div className="create__time-section">
                <label className="create__time-label">마감 시간</label>
                <div className="create__time-options">
                  {DEADLINE_OPTIONS.map(mins => (
                    <button
                      key={mins}
                      className={`create__time-option ${deadlineChoice === mins ? 'create__time-option--selected' : ''}`}
                      onClick={() => setDeadlineChoice(mins)}
                      type="button"
                    >
                      +{mins >= 60 ? `${mins / 60}시간` : `${mins}분`}
                    </button>
                  ))}
                  <button
                    aria-pressed={deadlineChoice === 'custom'}
                    className={`create__time-option ${deadlineChoice === 'custom' ? 'create__time-option--selected' : ''}`}
                    onClick={() => setDeadlineChoice('custom')}
                    type="button"
                  >
                    직접 설정
                  </button>
                </div>
                {deadlineChoice === 'custom' && (
                  <label className="create__number-field">
                    <span>몇 분 뒤에 마감할까요?</span>
                    <span className="create__number-control">
                      <input
                        aria-describedby="deadline-hint"
                        className="create__number-input"
                        inputMode="numeric"
                        max={MAX_DEADLINE_MINUTES}
                        min={5}
                        onChange={(event) => setCustomMinutes(event.target.value)}
                        step={1}
                        type="number"
                        value={customMinutes}
                      />
                      <span>분 후</span>
                    </span>
                    <small id="deadline-hint">5분부터 최대 24시간(1,440분)까지 설정할 수 있어요.</small>
                  </label>
                )}
              </div>

              <div className="create__time-section">
                <label className="create__time-label">최대 인원 (선택)</label>
                <div className="create__time-options">
                  <button
                    aria-pressed={!hasParticipantLimit}
                    className={`create__time-option ${!hasParticipantLimit ? 'create__time-option--selected' : ''}`}
                    onClick={() => setHasParticipantLimit(false)}
                    type="button"
                  >
                    제한 없음
                  </button>
                  <button
                    aria-pressed={hasParticipantLimit}
                    className={`create__time-option ${hasParticipantLimit ? 'create__time-option--selected' : ''}`}
                    onClick={() => setHasParticipantLimit(true)}
                    type="button"
                  >
                    인원 제한 설정
                  </button>
                </div>
                {hasParticipantLimit && (
                  <label className="create__number-field">
                    <span>최대 몇 명까지 받을까요?</span>
                    <span className="create__number-control">
                      <input
                        className="create__number-input"
                        inputMode="numeric"
                        max={50}
                        min={2}
                        onChange={(event) => setParticipantLimit(event.target.value)}
                        step={1}
                        type="number"
                        value={participantLimit}
                      />
                      <span>명</span>
                    </span>
                    <small>2명부터 50명까지 입력할 수 있어요.</small>
                  </label>
                )}
              </div>
            </>
          )}

          {error && <p className="auth__error">{error}</p>}
          <button
            className="create__submit-btn"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
            type="button"
          >
            {submitting ? '만드는 중...' : '팟 만들기'}
          </button>
    </section>
  );
}
