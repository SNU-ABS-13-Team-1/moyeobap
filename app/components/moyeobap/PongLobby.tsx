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
  player1Id: string;
  player1Name: string;
  player2Id: string | null;
  player2Name: string | null;
};

const STATUS_LABEL: Record<LobbyRoom['status'], string> = {
  waiting: 'WAITING',
  playing: 'PLAYING',
  finished: 'FINISHED',
};

export function PongLobby() {
  const router = useRouter();
  const { currentUser, openAuth } = useAuth();
  const { data, mutate } = useSWR<{ rooms: LobbyRoom[] }>('/api/games/pong/rooms', fetcher, {
    refreshInterval: 10000,
    refreshWhenHidden: false,
    revalidateOnFocus: true,
    dedupingInterval: 2000,
  });
  const [roomName, setRoomName] = useState('');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleCreate() {
    if (!currentUser) {
      openAuth('/games/pong');
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const response = await requestJson<{ room: { id: string } }>('/api/games/pong/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomName.trim() }),
      });
      router.push(`/games/pong/${response.room.id}`);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, '방을 만들지 못했어요.'));
      setBusy(false);
    }
  }

  async function handleJoin(room: LobbyRoom) {
    if (!currentUser) {
      openAuth('/games/pong');
      return;
    }
    const hasOpenSeat = room.status === 'waiting' && !room.player2Id;
    const isMine = room.player1Id === currentUser.id;
    if (!hasOpenSeat || isMine) {
      router.push(`/games/pong/${room.id}`);
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await requestJson(`/api/games/pong/rooms/${room.id}/join`, { method: 'POST' });
      router.push(`/games/pong/${room.id}`);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, '참여하지 못했어요.'));
      setBusy(false);
      mutate();
    }
  }

  const rooms = data?.rooms ?? [];

  return (
    <div className="pong-lobby">
      <div className="pong-lobby__toolbar">
        <input
          className="pong-lobby__name-input"
          maxLength={40}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="방 이름 (예: YH vs Woojin)"
          type="text"
          value={roomName}
        />
        <button className="pong-lobby__create-btn" disabled={busy} onClick={handleCreate} type="button">
          + CREATE ROOM
        </button>
      </div>

      <Link className="pong-lobby__ranking-link" href="/games/pong/ranking">
        🏆 RANKING
      </Link>

      {errorMessage && <p className="pong-lobby__error">{errorMessage}</p>}

      {rooms.length === 0 ? (
        <p className="pong-lobby__empty">대기 중인 방이 없어요. 새로 만들어보세요!</p>
      ) : (
        <table className="pong-lobby__table">
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
              const playerCount = room.player2Id ? 2 : 1;
              const hasOpenSeat = room.status === 'waiting' && !room.player2Id;
              const isMine = currentUser?.id === room.player1Id;
              return (
                <tr className="pong-lobby__row" key={room.id}>
                  <td className="pong-lobby__row-name">{room.roomName}</td>
                  <td>{playerCount} / 2</td>
                  <td>
                    <span className={`pong-lobby__status-badge pong-lobby__status-badge--${room.status}`}>
                      {STATUS_LABEL[room.status]}
                    </span>
                  </td>
                  <td>
                    <button
                      className="pong-lobby__join-btn"
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
