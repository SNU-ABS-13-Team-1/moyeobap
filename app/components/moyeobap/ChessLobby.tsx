'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { requestJson, getErrorMessage } from '../../lib/api-client';
import { useAuth } from './AuthProvider';

type LobbyRoom = {
  id: string;
  roomName: string;
  status: 'waiting' | 'playing' | 'finished';
  whiteId: string;
  whiteName: string;
  blackId: string | null;
  blackName: string | null;
  createdAt: string;
};

const STATUS_LABEL: Record<LobbyRoom['status'], string> = {
  waiting: '대기중',
  playing: '게임중',
  finished: '종료',
};

export function ChessLobby() {
  const router = useRouter();
  const { currentUser, openAuth } = useAuth();
  const { data, mutate } = useSWR<{ rooms: LobbyRoom[] }>('/api/games/chess/rooms', fetcher, {
    refreshInterval: 3000,
  });
  const [roomName, setRoomName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate() {
    if (!currentUser) {
      openAuth('/games/chess/online');
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const response = await requestJson<{ room: { id: string } }>('/api/games/chess/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomName.trim() }),
      });
      router.push(`/games/chess/online/${response.room.id}`);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, '방을 만들지 못했어요.'));
      setBusy(false);
    }
  }

  async function handleJoin(room: LobbyRoom) {
    if (!currentUser) {
      openAuth('/games/chess/online');
      return;
    }
    // 이미 자리가 찬 방(관전) 또는 내가 만든 방은 별도 참여 요청 없이 바로
    // 입장합니다. join API는 빈 자리를 새로 차지할 때만 호출합니다.
    const hasOpenSeat = room.status === 'waiting' && !room.blackId;
    const isMine = room.whiteId === currentUser.id;
    if (!hasOpenSeat || isMine) {
      router.push(`/games/chess/online/${room.id}`);
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await requestJson(`/api/games/chess/rooms/${room.id}/join`, { method: 'POST' });
      router.push(`/games/chess/online/${room.id}`);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, '참여하지 못했어요.'));
      setBusy(false);
      mutate();
    }
  }

  const rooms = data?.rooms ?? [];

  return (
    <div className="omok-lobby">
      <div className="omok-lobby__toolbar">
        <input
          className="omok-lobby__name-input"
          maxLength={40}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="방 이름 (예: 점심 체스 한 판)"
          type="text"
          value={roomName}
        />
        <button className="omok-lobby__create-btn" disabled={busy} onClick={handleCreate} type="button">
          + 새 방 만들기
        </button>
      </div>

      <Link className="omok-lobby__ranking-link" href="/games/chess/online/ranking">
        🏆 랭킹 보기
      </Link>

      {errorMessage && <p className="omok-lobby__error">{errorMessage}</p>}

      {rooms.length === 0 ? (
        <p className="omok-lobby__empty">대기 중인 방이 없어요. 새로 만들어보세요!</p>
      ) : (
        <table className="omok-lobby__table">
          <thead>
            <tr>
              <th>방 이름</th>
              <th>플레이어</th>
              <th>상태</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              const playerCount = room.blackId ? 2 : 1;
              const hasOpenSeat = room.status === 'waiting' && !room.blackId;
              const isMine = currentUser?.id === room.whiteId;
              return (
                <tr className="omok-lobby__row" key={room.id}>
                  <td className="omok-lobby__row-name">{room.roomName}</td>
                  <td>{playerCount} / 2</td>
                  <td>
                    <span className={`omok-lobby__status-badge omok-lobby__status-badge--${room.status}`}>
                      {STATUS_LABEL[room.status]}
                    </span>
                  </td>
                  <td>
                    <button
                      className="omok-lobby__join-btn"
                      disabled={busy}
                      onClick={() => handleJoin(room)}
                      type="button"
                    >
                      {isMine ? '입장하기' : hasOpenSeat ? '참여하기' : '관전하기'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
