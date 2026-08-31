'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { requestJson, getErrorMessage } from '../../lib/api-client';
import type { OpenRoom } from '../../lib/openRooms';
import { useAuth } from './AuthProvider';

// 미니게임 현황판. 오목·체스·루미큐브·갈틱폰에 열린 방을 게임 구분 없이
// 한 목록으로 보여주고, 로비를 거치지 않고 바로 들어갈 수 있게 합니다.
// 참여/관전 판단은 GameLobby와 같은 규칙입니다.

const STATUS_LABEL: Record<OpenRoom['status'], string> = {
  waiting: '대기중',
  playing: '게임중',
  presenting: '앨범 공개 중',
  scoring: '계가 중',
  night: '밤 진행 중',
  day: '낮 토론 중',
  voting: '투표 중',
};

/** 방장이거나 이미 자리에 앉아 있으면 참여 요청 없이 바로 들어갑니다. */
function isMember(room: OpenRoom, userId: string): boolean {
  return room.hostId === userId || room.memberIds.includes(userId);
}

export function OpenRoomsPanel() {
  const router = useRouter();
  const { currentUser, openAuth } = useAuth();
  const { data, isLoading, mutate } = useSWR<{ rooms: OpenRoom[] }>('/api/games/rooms', fetcher, {
    refreshInterval: 20000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 5000,
  });
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleEnter(room: OpenRoom) {
    if (!currentUser) {
      openAuth('/games');
      return;
    }

    // 자리가 찬 방(관전)이나 내가 이미 낀 방은 참여 요청 없이 바로 들어갑니다.
    if (!room.hasOpenSeat || isMember(room, currentUser.id)) {
      router.push(room.href);
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await requestJson(room.joinApi, { method: 'POST' });
      router.push(room.href);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, '참여하지 못했어요.'));
      setBusy(false);
      mutate();
    }
  }

  const rooms = data?.rooms ?? [];

  return (
    <section className="open-rooms">
      <div className="open-rooms__heading">
        <h2 className="open-rooms__title">지금 열려있는 방</h2>
        <p className="open-rooms__subtitle">게임 구분 없이 모아봤어요. 눌러서 바로 들어가세요.</p>
      </div>

      {errorMessage && <p className="open-rooms__error">{errorMessage}</p>}

      {rooms.length === 0 ? (
        <p className="open-rooms__empty">
          {isLoading
            ? '방 목록을 불러오는 중이에요…'
            : '지금 열려있는 방이 없어요. 위에서 게임을 골라 새 방을 만들어보세요!'}
        </p>
      ) : (
        <ul className="open-rooms__list">
          {rooms.map((room) => {
            const isMine = currentUser ? isMember(room, currentUser.id) : false;
            return (
              <li className="open-rooms__item" key={`${room.game}-${room.id}`}>
                <span className={`open-rooms__game open-rooms__game--${room.game}`}>
                  <span aria-hidden="true">{room.emoji}</span> {room.gameLabel}
                </span>
                <span className="open-rooms__info">
                  <span className="open-rooms__name">{room.roomName}</span>
                  {room.meta && <span className="open-rooms__meta">{room.meta}</span>}
                </span>
                <span className="open-rooms__count">
                  {room.playerCount} / {room.maxPlayers}
                </span>
                <span className={`open-rooms__status open-rooms__status--${room.status}`}>
                  {STATUS_LABEL[room.status]}
                </span>
                <button
                  className="open-rooms__enter-btn"
                  disabled={busy}
                  onClick={() => handleEnter(room)}
                  type="button"
                >
                  {isMine ? '입장하기' : room.hasOpenSeat ? '참여하기' : '관전하기'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
