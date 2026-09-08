'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import useSWR from 'swr';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetcher } from '../lib/fetcher';
import { requestJson } from '../lib/api-client';
import { createSupabaseBrowserClient } from '../lib/supabase/client';
import { GAME_ROOM_RECOVERY_DELAYS, POLLING_PRESETS } from '../lib/swrConfig';
import { createOmokRoomState, parseOmokRoomEvent, type OmokRoom, type OmokRoomResponse } from '../lib/omokRoomState';

type Action = 'move' | 'join' | 'resign' | 'rematch' | 'claim-win' | 'timeout';

export function useOmokRoom(
  roomId: string,
  userId: string | undefined,
  createClient = createSupabaseBrowserClient,
) {
  const readRetry = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelReadRetry = useCallback(() => {
    if (readRetry.current !== undefined) clearTimeout(readRetry.current);
    readRetry.current = undefined;
  }, []);
  const state = useMemo(() => createOmokRoomState(roomId), [roomId]);
  const readRoom = useCallback(async (url: string) => {
    const response = await fetcher<OmokRoomResponse>(url);
    return state.accept(response.room);
  }, [state]);
  const { data, error, mutate } = useSWR<OmokRoomResponse>(
    `/api/games/omok/rooms/${roomId}`, readRoom,
    {
      ...POLLING_PRESETS.GAME_ROOM,
      // 아래에서 focus/online/구독 완료를 한 경로로 합쳐 중복 복구 요청을 막습니다.
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      errorRetryCount: 2,
      onErrorRetry: (_error, _key, _config, revalidate, options) => {
        cancelReadRetry();
        if (options.retryCount > 2 || document.visibilityState === 'hidden' || navigator.onLine === false) return;
        readRetry.current = setTimeout(() => {
          readRetry.current = undefined;
          if (document.visibilityState !== 'hidden' && navigator.onLine !== false) revalidate(options);
        }, POLLING_PRESETS.GAME_ROOM.refreshInterval);
      },
    },
  );
  const synchronize = useCallback(() => state.synchronize(() => mutate()), [state, mutate]);
  const applyRoom = useCallback((room: OmokRoom) => {
    cancelReadRetry();
    return mutate(state.accept(room), { revalidate: false });
  }, [mutate, state, cancelReadRetry]);
  const sendAction = useCallback(async (action: Action, body?: Record<string, unknown>) => {
    const response = await requestJson<OmokRoomResponse>(`/api/games/omok/rooms/${roomId}/${action}`, {
      method: 'POST',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}),
    });
    // 이미 서버가 확정한 판을 받았으므로 성공 뒤 GET을 다시 하지 않습니다.
    await applyRoom(response.room);
  }, [roomId, applyRoom]);
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    let client: ReturnType<typeof createClient>;
    try {
      client = createClient();
    } catch {
      // 외부 실시간 클라이언트 초기화 실패를 화면에 알립니다. 20초 안전망은 유지합니다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReconnecting(true);
      return;
    }
    let disposed = false;
    let generation = 0;
    let channel: RealtimeChannel | undefined;
    let connected = false;
    let attempts = 0;
    let retryTimer: number | undefined;
    const visible = () => document.visibilityState !== 'hidden' && navigator.onLine !== false;
    const cancelRetry = () => {
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      retryTimer = undefined;
    };
    const recover = () => {
      if (disposed || !visible()) return;
      void synchronize().then(() => {
        if (!disposed && connected) {
          attempts = 0;
          setReconnecting(false);
        }
      }).catch(() => {
        if (!disposed) scheduleRecovery();
      });
    };
    function scheduleRecovery() {
      setReconnecting(true);
      if (!visible() || retryTimer !== undefined || attempts >= GAME_ROOM_RECOVERY_DELAYS.length) return;
      const delay = GAME_ROOM_RECOVERY_DELAYS[attempts++];
      retryTimer = window.setTimeout(() => {
        retryTimer = undefined;
        subscribe();
      }, delay);
    }
    function subscribe() {
      if (disposed || !visible()) return;
      const token = ++generation;
      if (channel) void client.removeChannel(channel).catch(() => {});
      connected = false;
      channel = client.channel(`omok-room-${roomId}`)
        .on('postgres_changes', {
          event: 'UPDATE', schema: 'public', table: 'omok_rooms', filter: `id=eq.${roomId}`,
        }, payload => {
          if (disposed || token !== generation) return;
          const room = parseOmokRoomEvent(payload.new, roomId);
          if (!room) {
            recover();
            return;
          }
          // 클라이언트끼리 보낸 신고가 아닌, RLS를 거친 DB의 확정 스냅샷입니다.
          void applyRoom(room).catch(() => recover());
        })
        .subscribe(status => {
          if (disposed || token !== generation) return;
          if (status === 'SUBSCRIBED') {
            connected = true;
            cancelRetry();
            // 최초 GET과 구독 완료 사이, 또는 연결이 끊긴 동안 놓친 상태를 복구합니다.
            recover();
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            connected = false;
            if (retryTimer === undefined && attempts < GAME_ROOM_RECOVERY_DELAYS.length) recover();
            scheduleRecovery();
          }
        });
    }
    const resume = () => {
      if (!visible()) return;
      cancelRetry();
      attempts = 0;
      if (!connected) subscribe();
      recover();
    };
    const visibilityChanged = () => {
      if (visible()) resume();
      else { cancelRetry(); cancelReadRetry(); }
    };
    const offline = () => {
      connected = false;
      cancelRetry();
      cancelReadRetry();
      setReconnecting(true);
    };
    subscribe();
    window.addEventListener('focus', resume);
    window.addEventListener('online', resume);
    window.addEventListener('offline', offline);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      disposed = true;
      generation++;
      cancelRetry();
      cancelReadRetry();
      window.removeEventListener('focus', resume);
      window.removeEventListener('online', resume);
      window.removeEventListener('offline', offline);
      document.removeEventListener('visibilitychange', visibilityChanged);
      if (channel) void client.removeChannel(channel).catch(() => {});
    };
    // 인증이 완료되거나 사용자가 바뀌면 해당 세션으로 다시 구독합니다.
  }, [roomId, userId, createClient, applyRoom, synchronize, cancelReadRetry]);

  return { room: data?.room, error, reconnecting, synchronize, sendAction };
}
