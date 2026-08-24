'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetcher } from '../../lib/fetcher';
import { requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import {
  BALL_MAX_SPEED,
  BALL_RADIUS,
  BALL_SPEED_INCREMENT,
  BALL_START_SPEED,
  BROADCAST_INTERVAL_MS,
  CANVAS_HEIGHT,
  CANVAS_WIDTH,
  COUNTDOWN_SECONDS,
  DISCONNECT_CLAIM_DELAY_MS,
  PADDLE_HEIGHT,
  PADDLE_MARGIN,
  PADDLE_SPEED,
  PADDLE_WIDTH,
  TARGET_SCORE,
} from '../../lib/pongConstants';
import { useAuth } from './AuthProvider';
import { Spectators } from './Spectators';
import { PongChat } from './PongChat';

type PongRoomData = {
  id: string;
  roomName: string;
  status: 'waiting' | 'playing' | 'finished';
  player1Id: string | null;
  player1Name: string | null;
  player2Id: string | null;
  player2Name: string | null;
  score1: number;
  score2: number;
  winner: 'player1' | 'player2' | null;
  startedAt: string | null;
};

type BroadcastState = { ballX: number; ballY: number; paddle1Y: number; paddle2Y: number };

const PADDLE_CENTER_Y = CANVAS_HEIGHT / 2 - PADDLE_HEIGHT / 2;
const UP_KEYS = new Set(['w', 'W', 'ArrowUp']);
const DOWN_KEYS = new Set(['s', 'S', 'ArrowDown']);

function clampPaddleY(y: number): number {
  return Math.max(0, Math.min(CANVAS_HEIGHT - PADDLE_HEIGHT, y));
}

function randomServeVelocity(towardLeft: boolean): { vx: number; vy: number } {
  const angle = (Math.random() * 0.6 - 0.3) * Math.PI; // -0.3π ~ 0.3π
  const dir = towardLeft ? -1 : 1;
  return { vx: Math.cos(angle) * BALL_START_SPEED * dir, vy: Math.sin(angle) * BALL_START_SPEED };
}

export function PongRoom({ roomId }: { roomId: string }) {
  const router = useRouter();
  const { currentUser } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [leaving, setLeaving] = useState(false);
  const [resigning, setResigning] = useState(false);
  const [confirmingResign, setConfirmingResign] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [sitting, setSitting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const { data, error, mutate } = useSWR<{ room: PongRoomData }>(
    `/api/games/pong/rooms/${roomId}`,
    fetcher,
    { refreshInterval: 2000 },
  );
  const room = data?.room;

  // 방 상태(점수/승패) 실시간 구독 — 참여자에게는 즉시 반영되고, 관전자는
  // 위 2초 polling으로 따라잡습니다. 공/패들 위치는 이 채널이 아니라
  // Broadcast로 별도 전달됩니다(아래 게임 루프 effect 참고).
  useEffect(() => {
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }
    const channel = supabase
      .channel(`pong-room-${roomId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pong_rooms', filter: `id=eq.${roomId}` },
        () => mutate(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, mutate]);

  const role: 'player1' | 'player2' | 'spectator' =
    currentUser?.id === room?.player1Id ? 'player1' : currentUser?.id === room?.player2Id ? 'player2' : 'spectator';

  // Presence: 접속 중인 사람(관전자 수, 상대 온라인 여부) 추적. room 전체가
  // 아니라 player1Id/player2Id가 바뀔 때만 재구독하도록 의존성을 좁혔습니다.
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [spectators, setSpectators] = useState<string[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // 호스트가 보내는 공/패들 상태(player2·관전자용)와, player2가 보내는
  // 자기 패들 입력(호스트용)을 담아두는 ref입니다. Presence 채널과 같은
  // 채널 위에서 Broadcast로 오갑니다(연결 하나로 접속 상태 + 게임 상태를
  // 함께 처리).
  const hostStateRef = useRef<BroadcastState>({
    ballX: CANVAS_WIDTH / 2,
    ballY: CANVAS_HEIGHT / 2,
    paddle1Y: PADDLE_CENTER_Y,
    paddle2Y: PADDLE_CENTER_Y,
  });
  const remotePaddle2YRef = useRef(PADDLE_CENTER_Y);

  useEffect(() => {
    if (!currentUser || !room) return undefined;
    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }

    const channel = supabase.channel(`pong-live-${roomId}`, {
      config: { presence: { key: currentUser.id } },
    });
    channelRef.current = channel;

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<{ userId: string; name: string; role: string }>();
      const ids = new Set<string>();
      const names: string[] = [];
      Object.values(state).forEach((metas) => {
        metas.forEach((meta) => {
          ids.add(meta.userId);
          if (meta.role === 'spectator' && !names.includes(meta.name)) names.push(meta.name);
        });
      });
      setOnlineUserIds(ids);
      setSpectators(names);
    });

    channel.on('broadcast', { event: 'state' }, ({ payload }) => {
      hostStateRef.current = payload as BroadcastState;
    });
    channel.on('broadcast', { event: 'input' }, ({ payload }) => {
      remotePaddle2YRef.current = clampPaddleY((payload as { paddleY: number }).paddleY);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({ userId: currentUser.id, name: currentUser.name, role });
      }
    });

    return () => {
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
    // room 전체가 아닌 player1Id/player2Id가 바뀔 때만 재구독하도록 의도적으로 좁힌 의존성입니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, currentUser, room?.player1Id, room?.player2Id]);

  const opponentId = role === 'player1' ? room?.player2Id : role === 'player2' ? room?.player1Id : null;
  const opponentName = role === 'player1' ? room?.player2Name : role === 'player2' ? room?.player1Name : null;
  const opponentOnline = !opponentId || onlineUserIds.has(opponentId);
  const showDisconnectBanner = Boolean(
    room && room.status === 'playing' && role !== 'spectator' && opponentId && !opponentOnline,
  );

  const [claimAvailable, setClaimAvailable] = useState(false);
  useEffect(() => {
    // 배너가 사라지면(상대 재접속 등) 몰수승 버튼도 즉시 함께 숨겨야 합니다.
    if (!showDisconnectBanner) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setClaimAvailable(false);
      return undefined;
    }
    const timer = window.setTimeout(() => setClaimAvailable(true), DISCONNECT_CLAIM_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [showDisconnectBanner]);

  // 카운트다운: waiting→playing 전환(또는 재시작) 때마다 startedAt이
  // 새로 찍히므로, 이 값이 바뀔 때마다 3-2-1-GO를 보여줍니다.
  const [countdown, setCountdown] = useState<number | null>(null);
  const countedStartedAtRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || room.status !== 'playing' || !room.startedAt) return undefined;
    if (countedStartedAtRef.current === room.startedAt) return undefined;
    countedStartedAtRef.current = room.startedAt;

    setCountdown(COUNTDOWN_SECONDS);
    const interval = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          window.clearInterval(interval);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [room]);

  // 결과 화면용 Rating 변동폭: 참가자면 방 입장 시점에 내 Rating을 한 번
  // 기록해두고, 게임이 끝나면 다시 조회해서 차이를 보여줍니다.
  const [ratingBefore, setRatingBefore] = useState<number | null>(null);
  const [ratingAfter, setRatingAfter] = useState<number | null>(null);
  const ratingFetchedForRef = useRef<string | null>(null);
  useEffect(() => {
    if (!room || role === 'spectator') return undefined;
    if (ratingFetchedForRef.current === room.startedAt) return undefined;
    ratingFetchedForRef.current = room.startedAt;
    let cancelled = false;
    requestJson<{ rating: { rating: number } }>('/api/games/pong/rating/me')
      .then((res) => {
        if (!cancelled) setRatingBefore(res.rating.rating);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [room, role]);

  useEffect(() => {
    if (!room || room.status !== 'finished' || role === 'spectator' || ratingBefore === null) return undefined;
    let cancelled = false;
    requestJson<{ rating: { rating: number } }>('/api/games/pong/rating/me')
      .then((res) => {
        if (!cancelled) setRatingAfter(res.rating.rating);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [room, role, ratingBefore]);

  // ===== 게임 루프 =====
  // player1(방장)만 실제 물리(공 위치/속도, 충돌, 득점 판정)를 계산합니다.
  // player2/관전자는 player1이 Broadcast로 보내주는 상태를 그대로
  // 그리기만 합니다. 이 아키텍처의 이유와 한계는 app/lib/pong.ts의
  // recordPoint 주석을 참고하세요.
  const keysRef = useRef<Set<string>>(new Set());
  const myPaddleYRef = useRef(PADDLE_CENTER_Y);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (UP_KEYS.has(e.key) || DOWN_KEYS.has(e.key)) {
        keysRef.current.add(e.key);
        e.preventDefault();
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      keysRef.current.delete(e.key);
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx || !room) return undefined;
    if (room.status !== 'playing' || countdown !== null) return undefined;

    canvas.width = CANVAS_WIDTH;
    canvas.height = CANVAS_HEIGHT;

    const isHost = role === 'player1';
    const ball = isHost
      ? { x: CANVAS_WIDTH / 2, y: CANVAS_HEIGHT / 2, ...randomServeVelocity(Math.random() < 0.5) }
      : null;
    let paddle1Y = PADDLE_CENTER_Y;
    let paddle2Y = PADDLE_CENTER_Y;
    let servingUntil = 0;
    let lastBroadcast = 0;
    let lastTime = performance.now();
    let rafId = 0;

    function moveMyPaddle(current: number, dt: number): number {
      let next = current;
      if (keysRef.current.has('w') || keysRef.current.has('W') || keysRef.current.has('ArrowUp')) {
        next -= PADDLE_SPEED * dt;
      }
      if (keysRef.current.has('s') || keysRef.current.has('S') || keysRef.current.has('ArrowDown')) {
        next += PADDLE_SPEED * dt;
      }
      return clampPaddleY(next);
    }

    function draw(ballX: number, ballY: number, p1: number, p2: number) {
      if (!ctx) return;
      ctx.fillStyle = '#0a0a0a';
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, 0);
      ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(PADDLE_MARGIN, p1, PADDLE_WIDTH, PADDLE_HEIGHT);
      ctx.fillRect(CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH, p2, PADDLE_WIDTH, PADDLE_HEIGHT);

      ctx.beginPath();
      ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
      ctx.fill();
    }

    function tick(now: number) {
      const dt = Math.min((now - lastTime) / 1000, 1 / 30);
      lastTime = now;

      if (isHost && ball) {
        paddle1Y = moveMyPaddle(paddle1Y, dt);
        paddle2Y = remotePaddle2YRef.current;

        const opponentAbsent = Boolean(opponentId) && !onlineUserIds.has(opponentId as string);
        if (now >= servingUntil && !opponentAbsent) {
          ball.x += ball.vx * dt;
          ball.y += ball.vy * dt;

          if (ball.y - BALL_RADIUS <= 0) {
            ball.y = BALL_RADIUS;
            ball.vy = Math.abs(ball.vy);
          } else if (ball.y + BALL_RADIUS >= CANVAS_HEIGHT) {
            ball.y = CANVAS_HEIGHT - BALL_RADIUS;
            ball.vy = -Math.abs(ball.vy);
          }

          const hitsPaddle1 =
            ball.vx < 0 &&
            ball.x - BALL_RADIUS <= PADDLE_MARGIN + PADDLE_WIDTH &&
            ball.x - BALL_RADIUS > PADDLE_MARGIN - 4 &&
            ball.y >= paddle1Y &&
            ball.y <= paddle1Y + PADDLE_HEIGHT;
          const hitsPaddle2 =
            ball.vx > 0 &&
            ball.x + BALL_RADIUS >= CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH &&
            ball.x + BALL_RADIUS < CANVAS_WIDTH - PADDLE_MARGIN + 4 &&
            ball.y >= paddle2Y &&
            ball.y <= paddle2Y + PADDLE_HEIGHT;

          if (hitsPaddle1 || hitsPaddle2) {
            const paddleY = hitsPaddle1 ? paddle1Y : paddle2Y;
            const offset = (ball.y - (paddleY + PADDLE_HEIGHT / 2)) / (PADDLE_HEIGHT / 2);
            const speed = Math.min(Math.hypot(ball.vx, ball.vy) + BALL_SPEED_INCREMENT, BALL_MAX_SPEED);
            const dir = hitsPaddle1 ? 1 : -1;
            const angle = offset * (Math.PI / 3.2); // 최대 ±56도 정도
            ball.vx = Math.cos(angle) * speed * dir;
            ball.vy = Math.sin(angle) * speed;
            ball.x = hitsPaddle1 ? PADDLE_MARGIN + PADDLE_WIDTH + BALL_RADIUS : CANVAS_WIDTH - PADDLE_MARGIN - PADDLE_WIDTH - BALL_RADIUS;
          }

          if (ball.x < -BALL_RADIUS * 2 || ball.x > CANVAS_WIDTH + BALL_RADIUS * 2) {
            const scorer = ball.x < 0 ? 'player2' : 'player1';
            ball.x = CANVAS_WIDTH / 2;
            ball.y = CANVAS_HEIGHT / 2;
            const next = randomServeVelocity(scorer === 'player1');
            ball.vx = next.vx;
            ball.vy = next.vy;
            servingUntil = now + 800;
            requestJson('/api/games/pong/rooms/' + roomId + '/score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ scorer }),
            })
              .then(() => mutate())
              .catch(() => mutate());
          }
        }

        if (now - lastBroadcast >= BROADCAST_INTERVAL_MS) {
          lastBroadcast = now;
          channelRef.current?.send({
            type: 'broadcast',
            event: 'state',
            payload: { ballX: ball.x, ballY: ball.y, paddle1Y, paddle2Y },
          });
        }

        draw(ball.x, ball.y, paddle1Y, paddle2Y);
      } else {
        // player2/관전자: 자기 패들(있다면)만 로컬로 움직이고, 나머지는
        // 호스트가 보내준 최신 상태를 그대로 그립니다.
        if (role === 'player2') {
          myPaddleYRef.current = moveMyPaddle(myPaddleYRef.current, dt);
          if (now - lastBroadcast >= BROADCAST_INTERVAL_MS) {
            lastBroadcast = now;
            channelRef.current?.send({
              type: 'broadcast',
              event: 'input',
              payload: { paddleY: myPaddleYRef.current },
            });
          }
        }
        const s = hostStateRef.current;
        const myPaddle = role === 'player2' ? myPaddleYRef.current : s.paddle2Y;
        draw(s.ballX, s.ballY, s.paddle1Y, myPaddle);
      }

      rafId = requestAnimationFrame(tick);
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
    // room 전체를 의존성에 넣으면 2초 polling마다 루프가 재시작돼 공 위치가
    // 계속 리셋됩니다. 루프를 새로 시작해야 하는 시점(playing 진입, 카운트
    // 다운 종료)만 좁혀서 의존성으로 둡니다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.id, countdown, role, roomId, mutate, opponentId, onlineUserIds]);

  async function handleLeaveRoom() {
    setLeaving(true);
    try {
      await requestJson(`/api/games/pong/rooms/${roomId}/leave`, { method: 'POST' });
    } catch {
      // 무시하고 로비로 이동합니다.
    }
    router.push('/games/pong');
  }

  // 관전자가 빈 자리에 앉습니다(대기 중인 방에 들어가는 것과 같은 엔드포인트).
  async function handleSitDown() {
    setSitting(true);
    try {
      await requestJson(`/api/games/pong/rooms/${roomId}/join`, { method: 'POST' });
      mutate();
    } catch {
      // 실패하면 다음 polling에서 최신 상태가 다시 반영됩니다.
    } finally {
      setSitting(false);
    }
  }

  // 기권은 그 판만 내주고 방에는 그대로 남습니다. 로비로 나가는 것은 대전이
  // 끝난 뒤 "게임 나가기"가 맡습니다. 실패해도 따로 알리지 않고 최신 상태만
  // 다시 불러옵니다(화면이 곧 진짜 상태를 보여줍니다).
  async function handleResign() {
    setResigning(true);
    try {
      await requestJson(`/api/games/pong/rooms/${roomId}/resign`, { method: 'POST' });
      setConfirmingResign(false);
    } catch {
      // 무시하고 새로고침
    } finally {
      setResigning(false);
      mutate();
    }
  }

  async function handleRestart() {
    setRestarting(true);
    try {
      await requestJson(`/api/games/pong/rooms/${roomId}/restart`, { method: 'POST' });
      setRatingBefore(null);
      setRatingAfter(null);
      mutate();
    } catch {
      // 무시
    } finally {
      setRestarting(false);
    }
  }

  async function handleClaimWin() {
    setClaiming(true);
    try {
      await requestJson(`/api/games/pong/rooms/${roomId}/claim-win`, { method: 'POST' });
      mutate();
    } catch {
      // 무시
    } finally {
      setClaiming(false);
    }
  }

  if (error) {
    return <div className="pong-room__state">방을 불러오지 못했어요.</div>;
  }
  if (!room) {
    return <div className="pong-room__state">불러오는 중...</div>;
  }

  const didIWin = role !== 'spectator' && room.winner === role;
  const player1Label = room.player1Name ?? '빈 자리';
  const player2Label = room.player2Name ?? '빈 자리';
  const emptySeat = !room.player1Id ? 'player1' : !room.player2Id ? 'player2' : null;
  // 자리가 비면 상대가 없으니 다시 시작할 수 없습니다.
  const canRestart = room.status === 'finished' && role !== 'spectator' && !emptySeat;
  const canSitDown = Boolean(emptySeat) && role === 'spectator';
  // 대전 중인 참가자만 기권할 수 있습니다(관전자·대기 중·종료 후는 제외).
  const canResign = room.status === 'playing' && role !== 'spectator';
  const ratingDelta = ratingBefore !== null && ratingAfter !== null ? ratingAfter - ratingBefore : null;
  const resultScoreText =
    role === 'spectator'
      ? `${room.score1} : ${room.score2}`
      : role === 'player1'
        ? `${room.score1} : ${room.score2}`
        : `${room.score2} : ${room.score1}`;

  return (
    <div className="pong-room-page__layout">
      <div className="pong-room-page__main">
        <div className="pong-room">
          <div className="pong-room__header">
            <h2 className="pong-room__name">{room.roomName}</h2>
            <Spectators className="pong-room__spectators" names={spectators} />
          </div>

          <div className="pong-room__scoreboard">
            <span className={role === 'player1' ? 'pong-room__player-label--me' : ''}>{player1Label}</span>
            <span className="pong-room__score">
              {room.score1} : {room.score2}
            </span>
            <span className={role === 'player2' ? 'pong-room__player-label--me' : ''}>
              {room.status === 'waiting' ? (room.player2Name ?? '(대기 중)') : player2Label}
            </span>
          </div>

          {room.status === 'waiting' && (
            <p className="pong-room__status">상대를 기다리는 중이에요. 로비에 방이 보이니 곧 들어올 거예요.</p>
          )}

          {showDisconnectBanner && (
            <div className="pong-room__disconnect-banner">
              <span>⚠️ {opponentName}님의 연결이 끊어졌습니다. 재접속을 기다리는 중이에요.</span>
              {claimAvailable && (
                <button disabled={claiming} onClick={handleClaimWin} type="button">
                  {claiming ? '처리 중...' : '몰수승 처리'}
                </button>
              )}
            </div>
          )}

          <div className="pong-room__canvas-wrap">
            <canvas className="pong-room__canvas" height={CANVAS_HEIGHT} ref={canvasRef} width={CANVAS_WIDTH} />

            {room.status === 'playing' && countdown !== null && (
              <div className="pong-room__countdown">{countdown === 0 ? 'GO!' : countdown}</div>
            )}

            {room.status === 'finished' && (
              <div className="pong-room__result">
                {role === 'spectator' ? (
                  <p className="pong-room__result-title">
                    {room.winner === 'player1' ? player1Label : player2Label}님 승리
                  </p>
                ) : (
                  <p className="pong-room__result-title">{didIWin ? 'YOU WIN!' : 'YOU LOSE'}</p>
                )}
                <p className="pong-room__result-score">
                  {resultScoreText}
                </p>
                {ratingDelta !== null && (
                  <p className="pong-room__result-rating">
                    Rating {ratingDelta >= 0 ? '+' : ''}
                    {ratingDelta}
                  </p>
                )}
                {emptySeat && (
                  <p className="pong-room__result-score">
                    {role === 'spectator'
                      ? '자리가 하나 비었어요. 앉으면 이어서 할 수 있어요.'
                      : '상대가 나가서 자리가 비었어요. 관전자가 앉으면 다시 할 수 있어요.'}
                  </p>
                )}
                <div className="pong-room__result-actions">
                  {canSitDown && (
                    <button disabled={sitting} onClick={handleSitDown} type="button">
                      {sitting ? 'SITTING...' : 'TAKE SEAT'}
                    </button>
                  )}
                  {canRestart && (
                    <button disabled={restarting} onClick={handleRestart} type="button">
                      {restarting ? '준비 중...' : 'PLAY AGAIN'}
                    </button>
                  )}
                  <button disabled={leaving} onClick={handleLeaveRoom} type="button">
                    EXIT
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className="pong-room__hint">W / S 또는 ↑ / ↓ 로 패들을 움직여요. 목표 점수: {TARGET_SCORE}점</p>

          <div className="pong-room__actions">
            {canSitDown && room.status !== 'finished' && (
              <button className="pong-room__leave-btn" disabled={sitting} onClick={handleSitDown} type="button">
                {sitting ? '앉는 중...' : '빈 자리에 앉기'}
              </button>
            )}
            {canResign && confirmingResign ? (
              <span className="rummy__confirm" role="alertdialog" aria-label="기권 확인">
                정말 기권할까요? 상대의 승리로 기록돼요.
                <button className="rummy__btn rummy__btn--danger" disabled={resigning} onClick={handleResign} type="button">
                  {resigning ? '처리 중...' : '기권'}
                </button>
                <button className="rummy__btn rummy__btn--ghost" disabled={resigning} onClick={() => setConfirmingResign(false)} type="button">
                  취소
                </button>
              </span>
            ) : canResign ? (
              <button className="pong-room__leave-btn" onClick={() => setConfirmingResign(true)} type="button">
                기권하기
              </button>
            ) : (
              <button className="pong-room__leave-btn" disabled={leaving} onClick={handleLeaveRoom} type="button">
                {leaving ? '나가는 중...' : '게임 나가기'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="pong-room-page__chat">
        <PongChat canPost={role !== 'spectator'} roomId={roomId} />
      </div>
    </div>
  );
}
