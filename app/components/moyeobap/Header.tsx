import type { User } from '../../types/moyeobap';

interface HeaderProps {
  activeFilter: 'all' | 'lunch' | 'cafe';
  setActiveFilter: (filter: 'all' | 'lunch' | 'cafe') => void;
  isAuthenticated: boolean;
  currentUser: User | null;
  onAuthClick: () => void;
}

export function Header({
  activeFilter,
  setActiveFilter,
  isAuthenticated,
  currentUser,
  onAuthClick,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header__logo">
        <span className="header__logo-emoji">🍚</span>
        <span className="header__logo-text text-gradient">모여밥</span>
      </div>

      <nav className="header__nav">
        <button
          className={`header__tab ${activeFilter === 'all' ? 'header__tab--active' : ''}`}
          aria-pressed={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
          type="button"
        >
          전체
        </button>
        <button
          className={`header__tab ${activeFilter === 'lunch' ? 'header__tab--active' : ''}`}
          aria-pressed={activeFilter === 'lunch'}
          onClick={() => setActiveFilter('lunch')}
          type="button"
        >
          점심 🍱
        </button>
        <button
          className={`header__tab ${activeFilter === 'cafe' ? 'header__tab--active' : ''}`}
          aria-pressed={activeFilter === 'cafe'}
          onClick={() => setActiveFilter('cafe')}
          type="button"
        >
          카페 ☕
        </button>
      </nav>

      <div className="header__auth">
        {isAuthenticated && currentUser ? (
          <button className="header__profile" onClick={onAuthClick} title="로그아웃" type="button">
            <div className="header__profile-avatar">{currentUser.initial}</div>
            <span className="header__profile-name">{currentUser.name}</span>
          </button>
        ) : (
          <button className="header__auth-btn" onClick={onAuthClick} type="button">
            <span>로그인</span>
          </button>
        )}
      </div>
    </header>
  );
}
