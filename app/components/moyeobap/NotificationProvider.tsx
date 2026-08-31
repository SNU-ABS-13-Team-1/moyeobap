'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import {
  countUnread,
  potIdFromPath,
  selectNewPots,
  shouldNotifyMessage,
  type NewPotCandidate,
} from '../../lib/notifications';
import { useAuth } from './AuthProvider';

// 게임을 하는 중에도 새 팟과 내 팟의 채팅을 눈치챌 수 있게 하는 알림 계층입니다.
//
// 새 팟은 서버 폴링, 채팅은 Realtime으로 들어옵니다. pots 테이블은 클라이언트에
// SELECT가 열려 있지 않아 구독할 수 없고, messages는 참여자에게 열려 있어
// 구독할 수 있기 때문입니다.

/** 새 팟 폴링 주기. 트래픽 방어를 위해 30초로 설정합니다. */
const POLL_INTERVAL_MS = 30_000;
/** 토스트가 화면에 머무는 시간. */
const TOAST_TTL_MS = 3_000;
/** 화면을 덮지 않도록 동시에 띄우는 토스트 수를 제한합니다. */
const MAX_VISIBLE_TOASTS = 3;

export type Toast = {
  key: string;
  kind: 'pot' | 'chat';
  text: string;
  href: string;
};

type OpenPot = NewPotCandidate & { name: string };

type Summary = {
  openPots: OpenPot[];
  myPotIds: string[];
  unread: { potId: string; name: string; count: number }[];
  unreadTotal: number;
  serverTime: string;
};

type NotificationValue = {
  newPotCount: number;
  unreadTotal: number;
  toasts: Toast[];
  dismissToast: (key: string) => void;
};

const EMPTY: NotificationValue = {
  newPotCount: 0,
  unreadTotal: 0,
  toasts: [],
  dismissToast: () => {},
};

const NotificationContext = createContext<NotificationValue>(EMPTY);

export function useNotifications(): NotificationValue {
  return useContext(NotificationContext);
}

const lastSeenKey = (userId: string) => `moyeobap:lastSeenPotAt:${userId}`;

function readLastSeen(userId: string): string | null {
  try {
    return window.localStorage.getItem(lastSeenKey(userId));
  } catch {
    return null;
  }
}

function writeLastSeen(userId: string, value: string) {
  try {
    window.localStorage.setItem(lastSeenKey(userId), value);
  } catch {
    // 사생활 보호 모드 등으로 저장이 막혀도 알림 자체는 계속 동작해야 합니다.
  }
}

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const pathname = usePathname();
  const userId = currentUser?.id ?? null;

  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastedRef = useRef<Set<string>>(new Set());

  // 로그인한 사람이 바뀌면 기준 시각을 다시 읽습니다.
  useEffect(() => {
    // 첫 방문은 지금을 기준으로 잡습니다. 이전 팟이 한꺼번에 뜨지 않게요.
    const next = userId ? readLastSeen(userId) ?? new Date().toISOString() : null;
    if (userId && next) writeLastSeen(userId, next);
    // localStorage는 서버 렌더에서 읽을 수 없어 마운트 후에 채웁니다(BgmPlayer와 같은 방식).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastSeen(next);
  }, [userId]);

  // 질의에 기준 시각을 넣지 않습니다 — 응답마다 키가 바뀌면 폴링이 스스로를
  // 다시 부르게 됩니다. 판정은 받아온 목록으로 여기서 합니다.
  const { data, mutate } = useSWR<Summary>(
    userId ? '/api/notifications/summary' : null,
    fetcher,
    {
      refreshInterval: POLL_INTERVAL_MS,
      refreshWhenHidden: false,
      revalidateOnFocus: true,
      dedupingInterval: 3000,
    },
  );

  // 서버 시계와의 차이를 재 둡니다. 현황판에 들어간 순간 기준 시각을 "지금"으로
  // 올려야 배지가 바로 사라지는데, 브라우저 시계를 그대로 쓰면 시계가 앞선
  // 사람은 진짜 새 팟을 놓칩니다. 응답 도착 시점과 서버 시각의 차이로 보정합니다.
  const serverOffsetRef = useRef(0);
  useEffect(() => {
    if (!data?.serverTime) return;
    serverOffsetRef.current = Date.parse(data.serverTime) - Date.now();
  }, [data?.serverTime]);
  const serverNowIso = useCallback(
    () => new Date(Date.now() + serverOffsetRef.current).toISOString(),
    [],
  );

  // 기준 시각은 응답에 실려 온 서버 시각을 씁니다. 렌더할 때마다 값이 달라지지
  // 않아야 계산이 순수해지고, 브라우저 시계가 틀어져도 판정이 흔들리지 않습니다.
  const newPots = useMemo(() => {
    if (!userId || !data) return [];
    return selectNewPots(data.openPots, {
      userId,
      lastSeenAt: lastSeen,
      now: new Date(data.serverTime),
    });
  }, [data, userId, lastSeen]);

  const pushToast = useCallback((toast: Toast) => {
    setToasts((current) => [...current, toast].slice(-MAX_VISIBLE_TOASTS));
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.key !== toast.key));
    }, TOAST_TTL_MS);
  }, []);

  const dismissToast = useCallback((toastKey: string) => {
    setToasts((current) => current.filter((item) => item.key !== toastKey));
  }, []);

  // 새로 올라온 팟을 토스트로 알립니다. 같은 팟을 두 번 띄우지 않습니다.
  useEffect(() => {
    for (const pot of newPots) {
      const toastKey = `pot:${pot.id}`;
      if (toastedRef.current.has(toastKey)) continue;
      toastedRef.current.add(toastKey);
      pushToast({
        key: toastKey,
        kind: 'pot',
        text: `${pot.name} 새 모집이 열렸어요`,
        href: `/pots/${pot.id}`,
      });
    }
  }, [newPots, pushToast]);

  // 내 팟의 채팅은 Realtime으로 즉시 받습니다.
  const myPotIds = useMemo(() => data?.myPotIds ?? [], [data?.myPotIds]);
  const myPotIdsKey = myPotIds.join(',');
  const nameByPot = useMemo(() => {
    const map = new Map<string, string>();
    for (const pot of data?.openPots ?? []) map.set(pot.id, pot.name);
    for (const entry of data?.unread ?? []) map.set(entry.potId, entry.name);
    return map;
  }, [data?.openPots, data?.unread]);
  // 구독을 다시 걸지 않고도 최신 이름을 쓰려고 ref로 들고 있습니다.
  const nameByPotRef = useRef(nameByPot);
  useEffect(() => {
    nameByPotRef.current = nameByPot;
  }, [nameByPot]);

  useEffect(() => {
    if (!userId || !myPotIdsKey) return undefined;

    let supabase;
    try {
      supabase = createSupabaseBrowserClient();
    } catch {
      return undefined;
    }

    const potIdSet = new Set(myPotIdsKey.split(','));
    const channel = supabase
      .channel(`pot-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `pot_id=in.(${myPotIdsKey})`,
        },
        (payload) => {
          const row = payload.new as { pot_id?: string; author_id?: string } | null;
          if (!row?.pot_id || !row.author_id) return;
          const notify = shouldNotifyMessage(
            { potId: row.pot_id, authorId: row.author_id },
            { userId, myPotIds: potIdSet },
          );
          if (!notify) return;
          const name = nameByPotRef.current.get(row.pot_id) ?? '참여 중인 팟';
          pushToast({
            key: `chat:${row.pot_id}:${performance.now()}`,
            kind: 'chat',
            text: `${name}에 새 메시지가 왔어요`,
            href: `/pots/${row.pot_id}`,
          });
          // 배지 숫자는 서버 집계(message_reads 기준)를 따릅니다.
          mutate();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // 구독은 내 팟 목록이 실제로 바뀔 때만 다시 겁니다.
  }, [userId, myPotIdsKey, pushToast, mutate]);

  // 화면을 옮기면 폴링 틱을 기다리지 않고 바로 다시 받아옵니다. 읽음 처리는
  // 서버에 이미 기록됐는데 헤더 숫자만 남아 있는 시간을 없앱니다.
  useEffect(() => {
    if (!userId) return;
    void mutate();
  }, [pathname, userId, mutate]);

  // 현황판을 열면 새 팟을 본 것으로 처리합니다. 직전 응답의 서버 시각이 아니라
  // 보정한 "지금"을 씁니다 — 그 사이에 생긴 팟까지 본 것으로 쳐야 배지가
  // 바로 사라집니다.
  useEffect(() => {
    if (!userId || pathname !== '/') return;
    const seenAt = serverNowIso();
    writeLastSeen(userId, seenAt);
    // 현황판을 보고 있는 동안은 계속 "본 것"으로 갱신됩니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLastSeen(seenAt);
    toastedRef.current.clear();
  }, [pathname, userId, data?.serverTime, serverNowIso]);

  // 지금 열어 보고 있는 팟은 헤더 숫자에서 뺍니다. 읽음이 서버에 기록되고
  // 폴링이 따라오기까지 배지가 남아 있던 시간을 없앱니다.
  const currentPotId = potIdFromPath(pathname);
  const unreadTotal = useMemo(
    () => countUnread(data?.unread ?? [], currentPotId),
    [data?.unread, currentPotId],
  );

  const value = useMemo<NotificationValue>(
    () => ({
      newPotCount: newPots.length,
      unreadTotal,
      toasts,
      dismissToast,
    }),
    [newPots.length, unreadTotal, toasts, dismissToast],
  );

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}
