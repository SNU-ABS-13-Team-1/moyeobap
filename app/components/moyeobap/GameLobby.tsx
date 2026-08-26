'use client';

import { type ReactNode, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { requestJson, getErrorMessage } from '../../lib/api-client';
import { useAuth } from './AuthProvider';

// 실시간 대전 공용 로비(방 목록·방 만들기·참여/관전). 오목·체스가 경로와
// "누가 방장이고 빈 자리가 있는지"를 읽는 방법만 다르게 넘겨서 같이 씁니다.

export type LobbyRoomBase = {
  id: string;
  roomName: string;
  status: 'waiting' | 'playing' | 'scoring' | 'presenting' | 'finished';
  createdAt: string;
};

export type GameLobbyConfig<Room extends LobbyRoomBase> = {
  /** 예: /api/games/omok/rooms */
  apiRooms: string;
  /** 예: /games/omok — 방은 `${pagePath}/${id}` */
  pagePath: string;
  /** 랭킹 페이지. 없는 게임(갈틱폰)은 비워 둡니다. */
  rankingPath?: string;
  namePlaceholder: string;
  hostId: (room: Room) => string | null;
  hasOpenSeat: (room: Room) => boolean;
  /** 현재 참여 인원(기본: 빈 자리가 있으면 1명, 없으면 2명). */
  playerCount?: (room: Room) => number;
  /** 최대 인원(기본 2). */
  maxPlayers?: number;
  /** 이미 참여한 방인지(다인 게임에서 "입장하기" 표시용). */
  isMember?: (room: Room, userId: string) => boolean;
  /** 목록의 "플레이어" 칸에 보여줄 추가 정보(예: 시간제). */
  roomMeta?: (room: Room) => string | null;
  /** 방 만들기 옆에 붙는 추가 입력(예: 시간제 선택). */
  createExtras?: ReactNode;
  /** 방 만들기 요청 본문에 합칠 값. */
  createBody?: () => Record<string, unknown>;
  /** 자리가 남은 대기 방도 "관전"으로 들어갈 수 있게 버튼을 하나 더 보여줍니다(다인 게임용). */
  allowSpectateWaiting?: boolean;
};

const STATUS_LABEL: Record<LobbyRoomBase['status'], string> = {
  waiting: '대기중',
  playing: '게임중',
  scoring: '계가중',
  presenting: '앨범 공개 중',
  finished: '종료',
};

export function GameLobby<Room extends LobbyRoomBase>({ config }: { config: GameLobbyConfig<Room> }) {
  const router = useRouter();
  const { currentUser, openAuth } = useAuth();
  const { data, mutate } = useSWR<{ rooms: Room[] }>(config.apiRooms, fetcher, {
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
      openAuth(config.pagePath);
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      const response = await requestJson<{ room: { id: string } }>(config.apiRooms, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName: roomName.trim(), ...(config.createBody?.() ?? {}) }),
      });
      router.push(`${config.pagePath}/${response.room.id}`);
    } catch (err) {
      setErrorMessage(getErrorMessage(err, '방을 만들지 못했어요.'));
      setBusy(false);
    }
  }

  async function handleJoin(room: Room) {
    if (!currentUser) {
      openAuth(config.pagePath);
      return;
    }
    // 자리가 찬 방(관전) 또는 내가 만든 방은 별도 참여 요청 없이 바로 입장합니다.
    const hasOpenSeat = config.hasOpenSeat(room);
    const isMine = config.hostId(room) === currentUser.id || Boolean(config.isMember?.(room, currentUser.id));
    if (!hasOpenSeat || isMine) {
      router.push(`${config.pagePath}/${room.id}`);
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    try {
      await requestJson(`${config.apiRooms}/${room.id}/join`, { method: 'POST' });
      router.push(`${config.pagePath}/${room.id}`);
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
          placeholder={config.namePlaceholder}
          type="text"
          value={roomName}
        />
        {config.createExtras}
        <button className="omok-lobby__create-btn" disabled={busy} onClick={handleCreate} type="button">
          + 새 방 만들기
        </button>
      </div>

      {config.rankingPath && (
        <Link className="omok-lobby__ranking-link" href={config.rankingPath}>
          🏆 랭킹 보기
        </Link>
      )}

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
              const hasOpenSeat = config.hasOpenSeat(room);
              const maxPlayers = config.maxPlayers ?? 2;
              const playerCount = config.playerCount ? config.playerCount(room) : hasOpenSeat ? 1 : 2;
              const isMine = currentUser?.id === config.hostId(room) || Boolean(currentUser && config.isMember?.(room, currentUser.id));
              const meta = config.roomMeta?.(room);
              return (
                <tr className="omok-lobby__row" key={room.id}>
                  <td className="omok-lobby__row-name">{room.roomName}</td>
                  <td>
                    {playerCount} / {maxPlayers}{meta ? <span className="omok-lobby__row-meta"> · {meta}</span> : null}
                  </td>
                  <td>
                    <span className={`omok-lobby__status-badge omok-lobby__status-badge--${room.status}`}>
                      {STATUS_LABEL[room.status]}
                    </span>
                  </td>
                  <td className="omok-lobby__row-actions">
                    <button className="omok-lobby__join-btn" disabled={busy} onClick={() => handleJoin(room)} type="button">
                      {isMine ? '입장하기' : hasOpenSeat ? '참여하기' : '관전하기'}
                    </button>
                    {config.allowSpectateWaiting && !isMine && hasOpenSeat && (
                      <button
                        className="omok-lobby__join-btn omok-lobby__join-btn--ghost"
                        disabled={busy}
                        onClick={() => {
                          if (!currentUser) {
                            openAuth(config.pagePath);
                            return;
                          }
                          router.push(`${config.pagePath}/${room.id}`);
                        }}
                        type="button"
                      >
                        관전
                      </button>
                    )}
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
