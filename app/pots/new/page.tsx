'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { Restaurant, SerializedPot } from '../../types/moyeobap';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { fetcher } from '../../lib/fetcher';
import { triggerConfetti } from '../../lib/moyeobap-utils';
import { useAuth } from '../../components/moyeobap/AuthProvider';
import { CreatePotForm } from '../../components/moyeobap/CreatePotModal';

export default function NewPotPage() {
  const router = useRouter();
  const { currentUser, isAuthLoading, openAuth } = useAuth();
  const { data, error, mutate } = useSWR<{ restaurants: Restaurant[] }>(
    '/api/restaurants',
    fetcher,
  );

  async function handleCreateCustomRestaurant(input: {
    name: string;
    category: 'lunch' | 'cafe';
  }): Promise<string | null> {
    if (!currentUser) {
      openAuth('/pots/new');
      return null;
    }
    try {
      const response = await requestJson<{ restaurant: Restaurant }>('/api/restaurants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await mutate();
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
      const response = await requestJson<{ pot: SerializedPot }>('/api/pots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId, minutes, maxParticipants }),
      });
      triggerConfetti();
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
          <p>음식점을 고르고 모집 마감 시간과 필요한 경우에만 최대 인원을 정하세요.</p>
        </div>
        <Link className="page-back-link" href="/">← 현황판으로</Link>
      </div>

      {!isAuthLoading && !currentUser && (
        <button className="auth-required-banner" onClick={() => openAuth('/pots/new')} type="button">
          <span>🔒 팟을 만들려면 Google 로그인이 필요해요.</span>
          <strong>로그인하기 →</strong>
        </button>
      )}

      {error ? (
        <div className="page-state" role="alert">매장 목록을 불러오지 못했어요.</div>
      ) : !data ? (
        <div className="page-state">매장 목록을 불러오는 중이에요...</div>
      ) : (
        <CreatePotForm
          onCreateCustomRestaurant={handleCreateCustomRestaurant}
          onSubmit={handleCreateSubmit}
          restaurants={data.restaurants}
        />
      )}
    </main>
  );
}
