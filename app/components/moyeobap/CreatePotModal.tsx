import { useMemo, useState } from 'react';
import type { Restaurant } from '../../types/moyeobap';

interface CreatePotFormProps {
  restaurants: Restaurant[];
  onCreateCustomRestaurant: (input: {
    name: string;
    category: 'lunch' | 'cafe';
  }) => Promise<string | null>;
  onSubmit: (restaurantId: string, minutes: number, maxParticipants: number | null) => Promise<string | null>;
}

const DEADLINE_OPTIONS = [15, 20, 30, 45, 60, 120, 180];
const MAX_DEADLINE_MINUTES = 24 * 60;

// 카테고리 시트에 있는 소분류 순서와 맞춰뒀습니다. 여기 없는 값(직접 추가한 매장 등)은 뒤로 밀립니다.
const SUB_CATEGORY_ORDER = [
  '한식', '중식', '일식', '양식', '치킨', '피자', '족발', '보쌈', '분식', '패스트푸드', '카페', '디저트',
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

export function CreatePotForm({
  restaurants,
  onCreateCustomRestaurant,
  onSubmit,
}: CreatePotFormProps) {
  const [mode, setMode] = useState<'list' | 'custom'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [deadlineChoice, setDeadlineChoice] = useState<number | 'custom'>(30);
  const [customMinutes, setCustomMinutes] = useState('90');
  const [hasParticipantLimit, setHasParticipantLimit] = useState(false);
  const [participantLimit, setParticipantLimit] = useState('4');
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<'lunch' | 'cafe'>('lunch');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const groupedRestaurants = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLocaleLowerCase('ko');
    const filtered = restaurants.filter((restaurant) =>
      `${restaurant.name} ${restaurant.subCategory ?? ''}`
        .toLocaleLowerCase('ko')
        .includes(normalizedSearch),
    );
    return groupBySubCategory(filtered);
  }, [restaurants, searchTerm]);

  const selectedMinutes = deadlineChoice === 'custom' ? Number(customMinutes) : deadlineChoice;
  const selectedCap = hasParticipantLimit ? Number(participantLimit) : null;
  const hasValidRestaurant = mode === 'list'
    ? Boolean(selectedRestaurantId)
    : customName.trim().length > 0;
  const hasValidDeadline = Number.isInteger(selectedMinutes)
    && selectedMinutes >= 5
    && selectedMinutes <= MAX_DEADLINE_MINUTES;
  const hasValidCap = selectedCap === null
    || (Number.isInteger(selectedCap) && selectedCap >= 2 && selectedCap <= 50);
  const canSubmit = hasValidRestaurant && hasValidDeadline && hasValidCap;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      let restaurantId = selectedRestaurantId;
      if (mode === 'custom') {
        restaurantId = await onCreateCustomRestaurant({
          name: customName.trim(),
          category: customCategory,
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
              onClick={() => setMode('list')}
            >
              목록에서 선택
            </button>
            <button
              type="button"
              className={`create__mode-tab ${mode === 'custom' ? 'create__mode-tab--active' : ''}`}
              onClick={() => setMode('custom')}
            >
              직접 입력
            </button>
          </div>

          {mode === 'list' ? (
            <>
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
                {groupedRestaurants.map(group => (
                  <div key={group.key} className="create__restaurant-group">
                    <p className="create__restaurant-group-label">{group.key}</p>
                    {group.items.map(r => (
                      <button
                        key={r.id}
                        className={`create__restaurant-item ${selectedRestaurantId === r.id ? 'create__restaurant-item--selected' : ''}`}
                        onClick={() => setSelectedRestaurantId(r.id)}
                        type="button"
                      >
                        <span className="create__restaurant-emoji">{r.emoji}</span>
                        <div className="create__restaurant-info">
                          <span className="create__restaurant-name">{r.name}</span>
                          <span className="create__restaurant-meta">
                            {r.category === 'lunch' ? '점심' : '카페'} · 최소 {r.minOrder.toLocaleString()}원 · {r.deliveryTime}
                          </span>
                        </div>
                      </button>
                    ))}
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
                onChange={e => setCustomName(e.target.value)}
              />
              <label className="create__time-label create__time-label--spaced">종류</label>
              <div className="create__time-options">
                <button
                  type="button"
                  className={`create__time-option ${customCategory === 'lunch' ? 'create__time-option--selected' : ''}`}
                  onClick={() => setCustomCategory('lunch')}
                >
                  점심
                </button>
                <button
                  type="button"
                  className={`create__time-option ${customCategory === 'cafe' ? 'create__time-option--selected' : ''}`}
                  onClick={() => setCustomCategory('cafe')}
                >
                  카페
                </button>
              </div>
              <p className="create__custom-note">
                목록에 없는 매장이에요. 대표메뉴·최소주문금액 같은 정보 없이 팟만 먼저 열립니다.
              </p>
            </div>
          )}

          {(mode === 'custom' || selectedRestaurantId) && (
            <>
              <div className="create__time-section">
                <label className="create__time-label">⏰ 마감 시간 설정</label>
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
                <label className="create__time-label">👥 최대 인원 (선택)</label>
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
            {submitting ? '만드는 중...' : '팟 만들기 🚀'}
          </button>
    </section>
  );
}
