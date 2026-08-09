"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePrototype } from "@/app/prototype-context";

export function SiteHeader() {
  const { currentUser, login, logout } = usePrototype();
  const searchParams = useSearchParams();
  const concept = searchParams.get("concept");

  // Hide global SiteHeader for scratch prototype since it has its own built-in header
  if (concept === "scratch-light") {
    return null;
  }

  return (
    <header className="site-header">
      <div className="header-left">
        <Link className="brand" href="/" aria-label="모여밥 실시간 현황판">
          <span className="brand-mark" aria-hidden="true">
            🍱
          </span>
          <span>
            <span className="brand-title">모여밥</span>
            <small className="campus-badge">📍 시흥캠퍼스</small>
          </span>
        </Link>
      </div>

      <div className="header-right">
        <Link href="/recruitments/new" className="header-create-btn">
          <span>+ 새 모집 열기</span>
        </Link>

        {currentUser ? (
          <div className="account-actions">
            <span className="user-info">
              <span className="slack-dot" title="Slack 로그인 됨" />
              <strong>{currentUser.name}</strong>
              <small>Slack 구성원</small>
            </span>
            <button type="button" className="logout-btn" onClick={logout}>
              로그아웃
            </button>
          </div>
        ) : (
          <button className="slack-login" type="button" onClick={login}>
            <span aria-hidden="true" className="slack-hash">#</span>
            <span>Slack 로그인</span>
          </button>
        )}
      </div>
    </header>
  );
}
