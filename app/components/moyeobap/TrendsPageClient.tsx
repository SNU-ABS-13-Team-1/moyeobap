"use client";

import Link from "next/link";
import useSWR from "swr";
import type { CampusStats, MyStatsReport } from "@/app/types/moyeobap";
import { fetcher } from "@/app/lib/fetcher";
export function TrendsPageClient() {
  const { data, error, isLoading } = useSWR<{
    campus: CampusStats;
    my: MyStatsReport | null;
  }>("/api/stats", fetcher, { refreshInterval: 10000 });

  if (isLoading) {
    return (
      <main className="trends-page">
        <div className="trends-loading">
          <div className="trends-spinner" />
          <p>캠퍼스 식사 트렌드 데이터를 분석하고 있어요...</p>
        </div>
      </main>
    );
  }

  if (error || !data?.campus) {
    return (
      <main className="trends-page">
        <div className="page-state">
          <p>식사 트렌드 데이터를 불러오지 못했습니다.</p>
        </div>
      </main>
    );
  }

  const { campus: stats, my: myStats } = data;
  const maxHourCount = Math.max(1, ...stats.peakHours.map((h) => h.count));

  return (
    <main className="trends-page">
      {/* 헤더 섹션 */}
      <header className="trends-header">
        <div className="trends-header__badge">📊 DATA INSIGHTS</div>
        <h1 className="trends-header__title">모여밥 캠퍼스 맛집 랭킹 & 트렌드</h1>
        <p className="trends-header__desc">
          우리 캠퍼스에서 일어난 실제 공동주문 기록 데이터를 분석한 인기 맛집 랭킹과 식사 패턴이에요.
        </p>
      </header>

      {/* 1. 인기 맛집 핫플레이스 TOP 5 랭킹 (최우선 배치) */}
      <section className="trends-section">
        <div className="trends-section__header">
          <div>
            <h2 className="trends-section__title">🏆 캠퍼스 인기 팟 TOP 5</h2>
            <p className="trends-section__subtitle">가장 팟이 자주 열리고 참여가 활발한 인기 팟들이에요.</p>
          </div>
          <span className="trends-section__badge">실시간 랭킹</span>
        </div>

        <div className="trends-ranking-list">
          {stats.topRestaurants.length > 0 ? (
            stats.topRestaurants.map((rest, index) => {
              const rank = index + 1;
              const cat = (rest.category || "").toLowerCase();
              const categoryLabel =
                cat === "lunch" || cat === "restaurant"
                  ? "점심 식사"
                  : cat === "cafe"
                  ? "카페/디저트"
                  : cat === "other"
                  ? "기타"
                  : rest.category || "기타";

              return (
                <div className="trends-rank-card" key={rest.restaurantId}>
                  <div className={`trends-rank-badge trends-rank-badge--${rank}`}>
                    {rank}
                  </div>
                  <div className="trends-rank-info">
                    <div className="trends-rank-name-row">
                      <strong className="trends-rank-name">{rest.name}</strong>
                      <span className="trends-rank-category">{categoryLabel}</span>
                    </div>
                    <div className="trends-rank-stats-row">
                      <span>총 {rest.potCount}회 모집</span>
                      <span>•</span>
                      <span>누적 참여 {rest.participantCount}명</span>
                    </div>
                  </div>
                  <Link
                    className="trends-rank-btn"
                    href={`/pots/new?restaurantId=${rest.restaurantId}`}
                  >
                    팟 열기
                  </Link>
                </div>
              );
            })
          ) : (
            <div className="trends-empty-card">
              <p>아직 팟이 개설된 식당이 없어요. 첫 번째 팟을 열어보세요!</p>
              <Link className="btn-primary" href="/pots/new" style={{ marginTop: "12px" }}>
                새 팟 만들기
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* 2. 차트 섹션 (피크 타임 + 카테고리 분포) */}
      <div className="trends-charts-row">
        {/* 시간대별 팟 피크 타임 막대 차트 */}
        <section className="trends-section trends-chart-card">
          <div className="trends-section__header">
            <div>
              <h2 className="trends-section__title">⏰ 시간대별 팟 오픈 트렌드</h2>
              <p className="trends-section__subtitle">어느 시간대에 주문이 가장 많이 시작될까요?</p>
            </div>
          </div>

          <div className="trends-bar-chart">
            <div className="trends-bar-chart__bars">
              {stats.peakHours.map((item) => {
                const heightPercent = maxHourCount > 0 ? (item.count / maxHourCount) * 100 : 0;
                const isPeak = item.count === maxHourCount && item.count > 0;
                return (
                  <div className="trends-bar-col" key={item.hour}>
                    <div className="trends-bar-track">
                      {item.count > 0 && (
                        <span className="trends-bar-value">{item.count}</span>
                      )}
                      <div
                        className={`trends-bar-fill ${isPeak ? "trends-bar-fill--peak" : ""}`}
                        style={{ height: `${Math.max(item.count > 0 ? 12 : 4, heightPercent)}%` }}
                        title={`${item.label}: ${item.count}건`}
                      />
                    </div>
                    <span className={`trends-bar-label ${isPeak ? "trends-bar-label--peak" : ""}`}>
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* 카테고리별 입맛 점유율 */}
        <section className="trends-section trends-chart-card">
          <div className="trends-section__header">
            <div>
              <h2 className="trends-section__title">🍱 캠퍼스 입맛 카테고리 점유율</h2>
              <p className="trends-section__subtitle">팀원들이 가장 많이 찾는 메뉴 종류예요.</p>
            </div>
          </div>

          <div className="trends-category-list">
            {stats.categoryDistribution.length > 0 ? (
              stats.categoryDistribution.map((cat, idx) => (
                <div className="trends-cat-row" key={cat.category}>
                  <div className="trends-cat-info">
                    <span className="trends-cat-name">
                      {idx === 0 ? "🥇 " : idx === 1 ? "🥈 " : idx === 2 ? "🥉 " : "• "}
                      {cat.label}
                    </span>
                    <span className="trends-cat-count">
                      {cat.count}건 ({cat.percentage}%)
                    </span>
                  </div>
                  <div className="trends-cat-bar-bg">
                    <div
                      className={`trends-cat-bar-fill trends-cat-bar-fill--${idx % 5}`}
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="trends-empty-text">아직 개설된 팟 데이터가 충분하지 않아요.</p>
            )}
          </div>
        </section>
      </div>



      {/* 4. 로그인 사용자 개인 통계 (로그인 시 노출) */}
      {myStats && (
        <section className="trends-section trends-my-report">
          <div className="trends-section__header">
            <h2 className="trends-section__title">👤 나의 모여밥 리포트</h2>
            <span className="trends-section__badge">개인 맞춤</span>
          </div>

          <div className="trends-my-grid">
            <div className="trends-my-card">
              <span className="trends-my-card__title">나의 식사 스타일</span>
              <strong className="trends-my-card__category">
                {myStats.favoriteCategory}
              </strong>
              <span className="trends-my-card__desc">
                지금까지 주문한 메뉴의 {myStats.favoriteCategoryPercentage}% 비중 (총 {myStats.totalJoinedPots}회 참여)
              </span>
            </div>

            <div className="trends-my-card trends-my-card--mates">
              <span className="trends-my-card__title">최고의 밥메이트 🤝</span>
              {myStats.topMates.length > 0 ? (
                <div className="trends-mates-list">
                  {myStats.topMates.map((mate, idx) => (
                    <div className="trends-mate-item" key={mate.name}>
                      <span className="trends-mate-rank">{idx + 1}위</span>
                      <div className="trends-mate-avatar">{mate.initial}</div>
                      <span className="trends-mate-name">{mate.name}</span>
                      <span className="trends-mate-count">{mate.count}회 동석</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="trends-mates-empty">아직 다른 참여자와 함께한 기록이 적어요.</p>
              )}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
