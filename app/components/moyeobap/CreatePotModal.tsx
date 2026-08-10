import React, { useState } from 'react';
import { Restaurant } from '../../types/moyeobap';

interface CreatePotModalProps {
  restaurants: Restaurant[];
  onClose: () => void;
  onSubmit: (restaurantId: string, minutes: number) => void;
}

export const CreatePotModal: React.FC<CreatePotModalProps> = ({
  restaurants,
  onClose,
  onSubmit,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string | null>(null);
  const [selectedMinutes, setSelectedMinutes] = useState(30);

  const filteredRestaurants = restaurants.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="modal-overlay modal-overlay--active" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">🍚 새 팟 만들기</h2>
          <button className="modal__close" onClick={onClose}>✕</button>
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
            {filteredRestaurants.map(r => (
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

          {selectedRestaurantId && (
            <div className="create__time-section">
              <label className="create__time-label">⏰ 마감 시간 설정</label>
              <div className="create__time-options">
                {[15, 20, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    className={`create__time-option ${selectedMinutes === mins ? 'create__time-option--selected' : ''}`}
                    onClick={() => setSelectedMinutes(mins)}
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
            disabled={!selectedRestaurantId}
            onClick={() => {
              if (selectedRestaurantId) {
                onSubmit(selectedRestaurantId, selectedMinutes);
              }
            }}
          >
            팟 만들기 🚀
          </button>
        </div>
      </div>
    </div>
  );
};
