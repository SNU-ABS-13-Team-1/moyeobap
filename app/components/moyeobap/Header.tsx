'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { BgmPlayer } from './BgmPlayer';
import { useNotifications } from './NotificationProvider';

interface NavItem {
  href: string;
  label: string;
  mobileLabel?: string;
  badge?: string;
  icon?: string;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: '/', label: '현황판' },
  { href: '/trends', label: '식사 트렌드', mobileLabel: '트렌드', badge: 'HOT' },
  { href: '/my', label: '내 참여' },
  { href: '/pots/new', label: '새 모집' },
  { href: '/games', label: '미니게임' },
] as const;

export function Header({ gamesEnabled }: { gamesEnabled: boolean }) {
  const pathname = usePathname();
  const { currentUser, openAuth, openProfile } = useAuth();
  const navItems = gamesEnabled ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== '/games');

  // 알림이 꺼져 있으면 Provider가 없고, 기본값 0이 내려와 배지가 그려지지 않습니다.
  const { newPotCount, unreadTotal } = useNotifications();
  const countFor = (href: string) => {
    if (href === '/') return newPotCount;
    if (href === '/my') return unreadTotal;
    return 0;
  };

  return (
    <header className="header">
      <Link aria-label="모여밥 현황판" className="header__logo" href="/">
        <Image
          alt=""
          className="header__logo-img"
          height={30}
          priority
          src="/icon.png"
          width={30}
        />
        <span className="header__logo-text">모여밥</span>
      </Link>

      <nav aria-label="주요 메뉴" className="site-nav">
        {navItems.map((item) => {
          const active = item.href === '/'
            ? pathname === '/'
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const count = countFor(item.href);
          return (
            <Link
              aria-current={active ? 'page' : undefined}
              className={`site-nav__link ${active ? 'site-nav__link--active' : ''}`}
              href={item.href}
              key={item.href}
            >
              {item.icon && <span className="site-nav__icon">{item.icon}</span>}
              <span className={item.mobileLabel ? 'site-nav__label-full' : ''}>{item.label}</span>
              {item.mobileLabel && <span className="site-nav__label-mobile">{item.mobileLabel}</span>}
              {item.badge && <span className="site-nav__badge">{item.badge}</span>}
              {count > 0 && (
                <span
                  aria-label={item.href === '/' ? `새 모집 ${count}건` : `읽지 않은 메시지 ${count}개`}
                  className="site-nav__count"
                >
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="header__auth">
        <BgmPlayer />
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
