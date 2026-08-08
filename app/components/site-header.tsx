"use client";

import Link from "next/link";
import { usePrototype } from "@/app/prototype-context";

export function SiteHeader() {
  const { currentUser, login, logout } = usePrototype();

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="모여밥 실시간 현황판">
        <span className="brand-mark" aria-hidden="true">
          ㅁ
        </span>
        <span>
          모여밥
          <small>서울대 시흥캠퍼스</small>
        </span>
      </Link>

      {currentUser ? (
        <div className="account-actions">
          <span>
            <strong>{currentUser.name}</strong>
            <small>Slack 인증 사용자</small>
          </span>
          <button type="button" onClick={logout}>
            로그아웃
          </button>
        </div>
      ) : (
        <button className="slack-login" type="button" onClick={login}>
          <span aria-hidden="true">#</span>
          Slack으로 로그인
          <small>프로토타입</small>
        </button>
      )}
    </header>
  );
}
