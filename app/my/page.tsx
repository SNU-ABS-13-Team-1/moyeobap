'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { Pot, Restaurant, SerializedPot } from '../types/moyeobap';
import { fetcher } from '../lib/fetcher';
import { useClock } from '../hooks/useClock';
import { useAuth } from '../components/moyeobap/AuthProvider';
import { PotCard } from '../components/moyeobap/PotCard';

function toPot(pot: SerializedPot): Pot {
  return { ...pot, deadline: new Date(pot.deadline) };
}

export default function MyPotsPage() {
  const router = useRouter();
  const { currentUser, isAuthLoading, openAuth } = useAuth();
  const now = useClock();
  const { data: potsData, error: potsError } = useSWR<{ pots: SerializedPot[] }>(
    currentUser ? '/api/pots' : null,
    fetcher,
    { refreshInterval: 4000 },
  );
  const { data: restaurantsData, error: restaurantsError } = useSWR<{ restaurants: Restaurant[] }>(
    '/api/restaurants',
    fetcher,
  );

  const restaurantsById = useMemo(
    () => new Map((restaurantsData?.restaurants ?? []).map((restaurant) => [restaurant.id, restaurant])),
    [restaurantsData],
  );
  const myPots = useMemo(
    () => (potsData?.pots ?? [])
      .map(toPot)
      .filter((pot) => pot.isParticipating)
      .sort((a, b) => {
        if (a.status === 'active' && b.status !== 'active') return -1;
        if (a.status !== 'active' && b.status === 'active') return 1;
        return b.deadline.getTime() - a.deadline.getTime();
      }),
    [potsData],
  );
  const activePots = myPots.filter((pot) => pot.status === 'active');
  const closedPots = myPots.filter((pot) => pot.status === 'closed');

  if (isAuthLoading) {
    return <main className="page-content"><div className="page-state">로그인 상태를 확인하는 중이에요...</div></main>;
  }

  if (!currentUser) {
    return (
      <main className="page-content">
        <div className="page-state my-page__login">
          <span>🔒</span>
          <h1>내 참여 모집</h1>
          <p>Google 로그인 후 참여 중인 팟과 채팅방을 한곳에서 확인할 수 있어요.</p>
          <button onClick={() => openAuth('/my')} type="button">Google로 로그인</button>
        </div>
      </main>
    );
  }

  const hasError = Boolean(potsError || restaurantsError);

  return (
    <main className="page-content my-page">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">내 채팅방</p>
          <h1>내 참여 모집</h1>
          <p>참여 중인 팟으로 이동해 모집 정보와 채팅을 바로 확인하세요.</p>
        </div>
      </div>

      {hasError ? (
        <div className="page-state" role="alert">내 참여 모집을 불러오지 못했어요.</div>
      ) : !potsData || !restaurantsData ? (
        <div className="page-state">내 참여 모집을 불러오는 중이에요...</div>
      ) : myPots.length === 0 ? (
        <div className="page-state">
          <span>💬</span>
          <h2>아직 참여한 팟이 없어요</h2>
          <p>현황판에서 함께 주문하고 싶은 팟을 찾아보세요.</p>
          <button onClick={() => router.push('/')} type="button">현황판 둘러보기</button>
        </div>
      ) : (
        <>
          <section className="my-page__section">
            <div className="my-page__section-heading">
              <h2>진행 중</h2><span>{activePots.length}</span>
            </div>
            {activePots.length === 0 ? (
              <p className="my-page__empty">현재 진행 중인 참여 모집이 없어요.</p>
            ) : (
              <div className="grid my-page__grid">
                {activePots.map((pot) => {
                  const restaurant = restaurantsById.get(pot.restaurantId);
                  if (!restaurant) return null;
                  return (
                    <PotCard
                      isAuthenticated
                      key={pot.id}
                      now={now}
                      onJoinClick={(id) => router.push(`/pots/${encodeURIComponent(id)}`)}
                      onOpenAuth={() => undefined}
                      pot={pot}
                      restaurant={restaurant}
                      showChatSummary
                    />
                  );
                })}
              </div>
            )}
          </section>

          <section className="my-page__section">
            <div className="my-page__section-heading">
              <h2>마감 후 채팅</h2><span>{closedPots.length}</span>
            </div>
            {closedPots.length === 0 ? (
              <p className="my-page__empty">마감된 참여 모집이 없어요.</p>
            ) : (
              <div className="grid my-page__grid">
                {closedPots.map((pot) => {
                  const restaurant = restaurantsById.get(pot.restaurantId);
                  if (!restaurant) return null;
                  return (
                    <PotCard
                      isAuthenticated
                      key={pot.id}
                      now={now}
                      onJoinClick={(id) => router.push(`/pots/${encodeURIComponent(id)}`)}
                      onOpenAuth={() => undefined}
                      pot={pot}
                      restaurant={restaurant}
                      showChatSummary
                    />
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}
