import React, { useState } from 'react';
import { Restaurant } from '../../types/moyeobap';

interface CreatePotModalProps {
  restaurants: Restaurant[];
  onClose: () => void;
  onCreateCustomRestaurant: (input: {
    name: string;
    category: 'lunch' | 'cafe';
  }) => Promise<string | null>;
  onSubmit: (restaurantId: string, minutes: number, maxParticipants: number | null) => void;
}

const CAP_OPTIONS = [2, 3, 4, 6, 8];

// 모집 마감까지 걸어둘 수 있는 시간(분). 1시간이 상한이면 미리 열어두는 팟을
// 만들 수 없다는 의견이 있어 2·3시간을 더했다.
const DEADLINE_OPTIONS = [15, 20, 30, 45, 60, 120, 180];

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

export const CreatePotModal: React.FC<CreatePotModalProps> = ({
  restaurants,
  onClose,
  onCreateCustomRestaurant,
  onSubmit,
}) => {
  const [mode, setMode] = useState<'list' | 'custom'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(30);
  const [selectedCap, setSelectedCap] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');
  const [customCategory, setCustomCategory] = useState<'lunch' | 'cafe'>('lunch');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const canSubmit = mode === 'list' ? Boolean(selectedRestaurantId) : customName.trim().length > 0;

  async function handleSubmit() {
    setError(null);
    if (mode === 'list') {
      if (selectedRestaurantId) onSubmit(selectedRestaurantId, selectedMinutes, selectedCap);
      return;
    }

    setSubmitting(true);
    const restaurantId = await onCreateCustomRestaurant({
      name: customName.trim(),
      category: customCategory,
    });
    setSubmitting(false);
    if (!restaurantId) {
      setError('매장을 추가하지 못했어요. 다시 시도해주세요.');
      return;
    }
    onSubmit(restaurantId, selectedMinutes, selectedCap);
  }

  return (
    <div className="modal-overlay modal-overlay--active" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">🍚 새 팟 만들기</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="modal__body">
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
                {groupBySubCategory(filteredRestaurants).map(group => (
                  <div key={group.key} className="create__restaurant-group">
                    <p className="create__restaurant-group-label">{group.key}</p>
                    {group.items.map(r => (
                      <div
                        key={r.id}
                        className={`create__restaurant-item ${selectedRestaurantId === r.id ? 'create__restaurant-item--selected' : ''}`}
                        onClick={() => setSelectedRestaurantId(r.id)}
                      >
                        <span className="create__restaurant-emoji">{r.emoji}</span>
                        <div className="create__restaurant-info">
                          <span className="create__restaurant-name">{r.name}</span>
                          <span className="create__restaurant-meta">
                            {r.category === 'lunch' ? '점심' : '카페'} · 최소 {r.minOrder.toLocaleString()}원 · {r.deliveryTime}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
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
              <label className="create__time-label" style={{ marginTop: 'var(--space-md)' }}>종류</label>
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
                      className={`create__time-option ${selectedMinutes === mins ? 'create__time-option--selected' : ''}`}
                      onClick={() => setSelectedMinutes(mins)}
                    >
                      +{mins < 60 ? `${mins}분` : `${mins / 60}시간`}
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
                  >
                    제한 없음
                  </button>
                  {CAP_OPTIONS.map(cap => (
                    <button
                      key={cap}
                      className={`create__time-option ${selectedCap === cap ? 'create__time-option--selected' : ''}`}
                      onClick={() => setSelectedCap(cap)}
                    >
                      {cap}명
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {error && <p className="auth__error">{error}</p>}
        </div>
        <div className="modal__footer">
          <button
            className="create__submit-btn"
            disabled={!canSubmit || submitting}
            onClick={handleSubmit}
          >
            {submitting ? '만드는 중...' : '팟 만들기 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
};
