'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';

const NAV_ITEMS = [
  { href: '/', label: '현황판' },
  { href: '/my', label: '내 참여' },
  { href: '/pots/new', label: '새 모집' },
] as const;

export function Header() {
  const pathname = usePathname();
  const { currentUser, openAuth, openProfile } = useAuth();

  return (
    <header className="header">
      <Link aria-label="모여밥 현황판" className="header__logo" href="/">
        <span className="header__logo-emoji">🍚</span>
        <span className="header__logo-text text-gradient">모여밥</span>
      </Link>

      <nav aria-label="주요 메뉴" className="site-nav">
        {NAV_ITEMS.map((item) => {
          const active = item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={`site-nav__link ${active ? 'site-nav__link--active' : ''}`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="header__auth">
        {currentUser ? (
          <button className="header__profile" onClick={openProfile} title="내 프로필" type="button">
            {currentUser.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="header__profile-avatar" src={currentUser.avatarUrl} />
            ) : (
              <div className="header__profile-avatar">{currentUser.initial}</div>
            )}
            <span className="header__profile-name">{currentUser.name}</span>
          </button>
        ) : (
          <button className="header__auth-btn" onClick={() => openAuth()} type="button">
            로그인
          </button>
        )}
      </div>
    </header>
  );
}
