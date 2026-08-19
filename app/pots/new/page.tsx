'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import type { Restaurant, SerializedPot } from '../../types/moyeobap';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { fetcher } from '../../lib/fetcher';
import { useAuth } from '../../components/moyeobap/AuthProvider';
import { CreatePotForm } from '../../components/moyeobap/CreatePotModal';

function NewPotContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRestaurantId = searchParams.get('restaurantId');
  const { currentUser, isAuthLoading, openAuth } = useAuth();
  const { data: restaurantsData, error: restaurantsError, mutate: mutateRestaurants } = useSWR<{ restaurants: Restaurant[] }>(
    '/api/restaurants',
    fetcher,
  );
  const { data: potsData, error: potsError } = useSWR<{ pots: SerializedPot[] }>(
    '/api/pots',
    fetcher,
    { refreshInterval: 4000 },
  );

  async function handleCreateCustomRestaurant(input: {
    name: string;
    category: 'lunch' | 'cafe' | 'other';
    saveToDirectory?: boolean;
  }): Promise<string | null> {
    if (!currentUser) {
      openAuth('/pots/new');
      return null;
    }
    try {
      const response = await requestJson<{ restaurant: Restaurant; reused: boolean }>('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await mutateRestaurants();
      return response.restaurant.id;
    } catch {
      return null;
    }
  }

  async function handleCreateSubmit(
    restaurantId: string,
    minutes: number,
    maxParticipants: number | null,
  ): Promise<string | null> {
    if (!currentUser) {
      openAuth('/pots/new');
      return '로그인 후 팟을 만들 수 있어요.';
    }
    try {
      const response = await requestJson<{ pot: SerializedPot; reused: boolean }>('/api/pots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, minutes, maxParticipants }),
      });
      router.push(`/pots/${encodeURIComponent(response.pot.id)}`);
      return null;
    } catch (submitError) {
      return getErrorMessage(submitError, '팟을 만들지 못했어요.');
    }
  }

  return (
    <main className="page-content create-page">
      <div className="page-heading">
        <div>
          <p className="page-heading__eyebrow">새 공동주문</p>
          <h1>새 팟 만들기</h1>
          <p>함께 주문할 매장과 마감 시간을 정해주세요.</p>
        </div>
        <Link className="page-back-link" href="/">← 현황판으로</Link>
      </div>

      {!isAuthLoading && !currentUser && (
        <button className="auth-required-banner" onClick={() => openAuth('/pots/new')} type="button">
          <span>🔒 팟을 만들려면 Google 로그인이 필요해요.</span>
          <strong>로그인하기 →</strong>
        </button>
      )}

      {restaurantsError || potsError ? (
        <div className="page-state" role="alert">매장과 모집 목록을 불러오지 못했어요.</div>
      ) : !restaurantsData || !potsData ? (
        <div className="page-state">매장 목록을 불러오는 중이에요...</div>
      ) : (
        <CreatePotForm
          initialRestaurantId={initialRestaurantId}
          onCreateCustomRestaurant={handleCreateCustomRestaurant}
          onSubmit={handleCreateSubmit}
          pots={potsData.pots}
          restaurants={restaurantsData.restaurants.filter((restaurant) => !restaurant.isOneTime)}
        />
      )}
    </main>
  );
}

export default function NewPotPage() {
  return (
    <Suspense fallback={<main className="page-content create-page"><div className="page-state">페이지를 불러오는 중이에요...</div></main>}>
      <NewPotContent />
    </Suspense>
  );
}
