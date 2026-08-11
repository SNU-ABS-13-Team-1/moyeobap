import React from 'react';
import { User } from '../../types/moyeobap';

interface HeaderProps {
  activeFilter: 'all' | 'lunch' | 'cafe';
  setActiveFilter: (filter: 'all' | 'lunch' | 'cafe') => void;
  isAuthenticated: boolean;
  currentUser: User | null;
  onAuthClick: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeFilter,
  setActiveFilter,
  isAuthenticated,
  currentUser,
  onAuthClick,
}) => {
  return (
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
          <div className="header__profile" onClick={onAuthClick} title="클릭하여 로그아웃">
            <div className="header__profile-avatar">{currentUser.initial}</div>
            <span className="header__profile-name">{currentUser.name}</span>
          </div>
        ) : (
          <button className="header__auth-btn" onClick={onAuthClick}>
            <span>로그인</span>
          </button>
        )}
      </div>
    </header>
  );
};
