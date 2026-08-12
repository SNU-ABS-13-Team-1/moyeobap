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
  );
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [authReturnPath, setAuthReturnPath] = useState('/');
  const { toast, showToast } = useToastNotice();
  const currentUser = data?.user ?? null;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authError = params.get('authError');
    if (!authError) return;

    const timer = window.setTimeout(() => {
      showToast(
        authError === 'not_configured'
          ? 'Supabase 로그인 환경 변수가 아직 설정되지 않았어요.'
          : 'Google 로그인을 완료하지 못했어요. 다시 시도해주세요.',
        'error',
      );
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
      const supabase = createSupabaseBrowserClient();
      const callbackUrl = new URL('/auth/callback', window.location.origin);
      callbackUrl.searchParams.set('next', authReturnPath);
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
          onSave={handleProfileSave}
          user={currentUser}
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
