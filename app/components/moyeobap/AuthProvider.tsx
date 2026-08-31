'use client';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import type { User } from '../../types/moyeobap';
import { fetcher } from '../../lib/fetcher';
import { getErrorMessage, requestJson } from '../../lib/api-client';
import { createSupabaseBrowserClient } from '../../lib/supabase/client';
import { useToastNotice } from '../../hooks/useToastNotice';
import { AuthModal } from './AuthModal';
import { ProfileModal, type ProfileInput } from './ProfileModal';
import { FeedbackModal } from './FeedbackModal';
import { ToastNotice } from './ToastNotice';

interface AuthContextValue {
  currentUser: User | null;
  isAuthLoading: boolean;
  openAuth: (returnPath?: string) => void;
  openProfile: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { mutate: mutateCache } = useSWRConfig();
  const { data, isLoading, mutate: mutateMe } = useSWR<{ user: User | null }>(
    '/api/auth/me',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 10000,
    },
  );
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [authReturnPath, setAuthReturnPath] = useState('/');
  const { toast, showToast } = useToastNotice();
  const currentUser = data?.user ?? null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('authError');
    if (!authError) return;

    const errorMessage = authError === 'not_configured'
      ? '현재 로그인을 사용할 수 없어요. 잠시 후 다시 시도해주세요.'
      : authError === 'profile_failed'
        ? '로그인은 완료됐지만 프로필을 준비하지 못했어요. 잠시 후 다시 시도해주세요.'
        : 'Google 로그인을 완료하지 못했어요. 다시 시도해주세요.';

    const timer = window.setTimeout(() => {
      showToast(errorMessage, 'error');
      params.delete('authError');
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${params.size ? `?${params}` : ''}`,
      );
    }, 0);
    return () => window.clearTimeout(timer);
  }, [showToast]);

  function openAuth(returnPath?: string) {
    const currentPath = typeof window === 'undefined'
      ? '/'
      : `${window.location.pathname}${window.location.search}`;
    setAuthReturnPath(returnPath ?? currentPath);
    setIsAuthOpen(true);
  }

  async function handleLogin(): Promise<string | null> {
    try {
      await requestJson('/api/auth/return-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ returnPath: authReturnPath }),
      });
      const supabase = createSupabaseBrowserClient();
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: callbackUrl.toString() },
      });
      return error?.message ?? null;
    } catch (error) {
      return getErrorMessage(error, 'Google 로그인을 시작하지 못했어요.');
    }
  }

  async function handleProfileSave(input: ProfileInput): Promise<string | null> {
    try {
      const profile = await requestJson<{ user: User }>('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      await mutateMe({ user: profile.user }, { revalidate: false });
      setIsProfileOpen(false);
      showToast('프로필을 저장했어요.', 'success');
      return null;
    } catch (error) {
      return getErrorMessage(error, '프로필을 저장하지 못했어요.');
    }
  }

  async function handleLogout() {
    await requestJson('/api/auth/logout', { method: 'POST' });
    await mutateMe({ user: null }, { revalidate: false });
    await mutateCache('/api/pots');
    setIsProfileOpen(false);
    showToast('로그아웃 되었습니다.', 'success');
  }

  async function handleFeedbackSubmit(content: string): Promise<string | null> {
    try {
      await requestJson('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          pagePath: `${window.location.pathname}${window.location.search}`,
        }),
      });
      setIsFeedbackOpen(false);
      showToast('피드백을 보냈어요. 고맙습니다!', 'success');
      return null;
    } catch (error) {
      return getErrorMessage(error, '피드백을 보내지 못했어요.');
    }
  }

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isAuthLoading: isLoading,
        openAuth,
        openProfile: () => setIsProfileOpen(true),
      }}
    >
      {children}
      {isAuthOpen && (
        <AuthModal onClose={() => setIsAuthOpen(false)} onLogin={handleLogin} />
      )}
      {isProfileOpen && currentUser && (
        <ProfileModal
          onClose={() => setIsProfileOpen(false)}
          onLogout={handleLogout}
          onOpenFeedback={() => {
            setIsProfileOpen(false);
            setIsFeedbackOpen(true);
          }}
          onSave={handleProfileSave}
          user={currentUser}
        />
      )}
      {isFeedbackOpen && currentUser && (
        <FeedbackModal
          onClose={() => setIsFeedbackOpen(false)}
          onSubmit={handleFeedbackSubmit}
        />
      )}
      <ToastNotice toast={toast} />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.');
  return value;
}
