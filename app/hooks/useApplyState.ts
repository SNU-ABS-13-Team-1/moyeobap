'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, getErrorMessage, requestJson } from '../lib/api-client';
import type { ApplySaveResult, ApplyState } from '../lib/moyeoApply';

/** Invalidation only: neither ranks nor participant lists leave this tab. */
function watchChanges(userId: string, changed: () => void) {
  const key = `moyeo-apply-changed:${userId}`;
  let channel: BroadcastChannel | undefined;
  try { channel = new window.BroadcastChannel(key); } catch { /* Storage fallback below. */ }
  let lastSignal: string | null = null;
  function receive(value: unknown) {
    if (typeof value !== 'string' || value === lastSignal) return;
    lastSignal = value;
    changed();
  }
  const storage = (event: StorageEvent) => {
    if (event.key === key) receive(event.newValue);
  };
  if (channel) channel.onmessage = (event) => receive(event.data);
  window.addEventListener('storage', storage);
  return {
    notify() {
      const signal = crypto.randomUUID();
      lastSignal = signal;
      try { channel?.postMessage(signal); } catch { /* Storage still works independently. */ }
      // Send through both transports; the signal deduplicates them in receivers.
      // Only an opaque revision signal is persisted, never the response or rank.
      try { window.localStorage.setItem(key, signal); } catch { /* Focus revalidation remains available. */ }
    },
    close() {
      channel?.close();
      window.removeEventListener('storage', storage);
    },
  };
}

export function useApplyState(userId: string) {
  const [state, setState] = useState<ApplyState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [verified, setVerified] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mounted = useRef(false);
  const savingRef = useRef(false);
  const sequence = useRef(0);
  const pendingRead = useRef<AbortController | null>(null);
  const changes = useRef<ReturnType<typeof watchChanges> | null>(null);

  const invalidate = useCallback(() => {
    sequence.current += 1;
    pendingRead.current?.abort();
    pendingRead.current = null;
    setVerified(false);
    // Drop the entire list, including its potentially rank-derived ordering.
    setState((previous) => previous ? { ...previous, participants: null } : null);
    setLoading(true);
    setReadError(null);
  }, []);

  const refresh = useCallback(() => {
    // Focus + visibility/pageshow often arrive together. Share one recovery read.
    if (!mounted.current || pendingRead.current || savingRef.current) return;
    invalidate();
    if (document.visibilityState === 'hidden') return;
    const controller = new AbortController();
    pendingRead.current = controller;
    const request = sequence.current;
    void requestJson<ApplyState>('/api/apply', { cache: 'no-store', signal: controller.signal })
      .then((next) => {
        if (!mounted.current || controller.signal.aborted || request !== sequence.current) return;
        setState(next);
        setVerified(true);
      })
      .catch((error: unknown) => {
        if (!mounted.current || controller.signal.aborted || request !== sequence.current) return;
        setReadError(getErrorMessage(error, '지망을 불러오지 못했어요. 다시 시도해주세요.'));
        if (error instanceof ApiError && error.status === 401) setState(null);
      })
      .finally(() => {
        if (!mounted.current || controller.signal.aborted || request !== sequence.current) return;
        pendingRead.current = null;
        setLoading(false);
      });
  }, [invalidate]);

  useEffect(() => {
    mounted.current = true;
    const changed = () => { invalidate(); refresh(); };
    const visibility = () => {
      if (document.visibilityState === 'hidden') invalidate();
      else refresh();
    };
    changes.current = watchChanges(userId, changed);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('focus', refresh);
    window.addEventListener('pageshow', refresh);
    // A page entering the back-forward cache must not keep a visible rank list.
    window.addEventListener('pagehide', invalidate);
    refresh();
    return () => {
      mounted.current = false;
      sequence.current += 1;
      pendingRead.current?.abort();
      pendingRead.current = null;
      changes.current?.close();
      changes.current = null;
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('pageshow', refresh);
      window.removeEventListener('pagehide', invalidate);
    };
  }, [userId, invalidate, refresh]);

  async function mutate(action: 'save' | 'confirm', choices?: string[], academicRank?: number | null) {
    if (!state || savingRef.current || loading) return null;
    savingRef.current = true;
    setSaving(true);
    invalidate();
    setSaveError(null);
    setNotice(null);
    const notifier = changes.current;
    try {
      const result = await requestJson<ApplySaveResult>('/api/apply', {
        method: action === 'confirm' ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          choices, academicRank,
          expectedEditCount: state.submission?.editCount ?? null,
          expectedUpdatedAt: state.submission?.updatedAt ?? null,
        }),
      });
      if (!mounted.current) return null;
      // Confirm own save, but only a fresh state read may restore rank access.
      setState((previous) => previous ? { ...previous, submission: result.submission, participants: null } : null);
      setNotice(action === 'confirm' ? '제출 완료로 확정했어요. 이제 지망과 석차를 수정할 수 없어요.' : result.changed ? '내 지망을 저장했어요.' : '변경된 내용이 없어 수정 횟수를 사용하지 않았어요.');
      return result;
    } catch (error) {
      if (!mounted.current) return null;
      setSaveError(getErrorMessage(error, '지망을 저장하지 못했어요. 다시 시도해주세요.'));
      if (error instanceof ApiError && error.status === 401) setState(null);
      return null;
    } finally {
      savingRef.current = false;
      // Also invalidate other tabs after an ambiguous/lost save response: the
      // write may have committed. The signal never grants access on its own.
      notifier?.notify();
      if (mounted.current) {
        setSaving(false);
        refresh();
      }
    }
  }

  const save = (choices: string[], academicRank: number | null) => mutate('save', choices, academicRank);
  const confirm = () => mutate('confirm');

  return {
    state, loading, saving, readError, saveError, notice, refresh, save, confirm,
    canViewAcademicRanks: verified && state?.submission?.academicRank != null,
  };
}
