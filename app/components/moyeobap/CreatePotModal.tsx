import { useMemo, useState } from 'react';
import type { Restaurant } from '../../types/moyeobap';
import { Modal } from './Modal';

interface CreatePotModalProps {
  restaurants: Restaurant[];
  onClose: () => void;
  onCreateCustomRestaurant: (input: {
    name: string;
    category: 'lunch' | 'cafe';
  }) => Promise<string | null>;
  onSubmit: (restaurantId: string, minutes: number, maxParticipants: number | null) => Promise<string | null>;
}

const CAP_OPTIONS = [2, 3, 4, 6, 8];

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

export function CreatePotModal({
  restaurants,
  onClose,
  onCreateCustomRestaurant,
  onSubmit,
}: CreatePotModalProps) {
  const [mode, setMode] = useState<'list' | 'custom'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(30);
  const [selectedCap, setSelectedCap] = useState<number | null>(null);
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

  const canSubmit = mode === 'list' ? Boolean(selectedRestaurantId) : customName.trim().length > 0;

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

  const footer = (
    <button
      className="create__submit-btn"
      disabled={!canSubmit || submitting}
      onClick={handleSubmit}
      type="button"
    >
      {submitting ? '만드는 중...' : '팟 만들기 🚀'}
    </button>
  );

  return (
    <Modal footer={footer} onClose={onClose} title="🍚 새 팟 만들기">
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
                  {[15, 20, 30, 45, 60].map(mins => (
                    <button
                      key={mins}
                      className={`create__time-option ${selectedMinutes === mins ? 'create__time-option--selected' : ''}`}
                      onClick={() => setSelectedMinutes(mins)}
                      type="button"
                    >
                      +{mins === 60 ? '1시간' : `${mins}분`}
                    </button>
                  ))}
                </div>
              </div>

              <div className="create__time-section">
                <label className="create__time-label">👥 최대 인원 (선택)</label>
                <div className="create__time-options">
                  <button
                    className={`create__time-option ${selectedCap === null ? 'create__time-option--selected' : ''}`}
                    onClick={() => setSelectedCap(null)}
                    type="button"
                  >
                    제한 없음
                  </button>
                  {CAP_OPTIONS.map(cap => (
                    <button
                      key={cap}
                      className={`create__time-option ${selectedCap === cap ? 'create__time-option--selected' : ''}`}
                      onClick={() => setSelectedCap(cap)}
                      type="button"
                    >
                      {cap}명
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className="auth__error">{error}</p>}
    </Modal>
  );
}
