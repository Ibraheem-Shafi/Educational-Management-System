import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { apiClient } from './api';
import { APP_ROLE } from './config';
import { registerPushToken } from './push';
import { getSupabase } from './supabase';
import type { AuthMeResponse, AuthUser } from './types';

interface AuthContextValue {
  session: Session | null;
  user: AuthUser | null;
  accessToken: string | null;
  loading: boolean;
  roleError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearRoleError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function validateRole(accessToken: string): Promise<AuthUser> {
  const me = await apiClient<AuthMeResponse>('/auth/me', { token: accessToken });
  if (!me.user.roles.includes(APP_ROLE)) {
    throw new Error(`This app is for ${APP_ROLE}s only. Your account does not have the ${APP_ROLE} role.`);
  }
  return me.user;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const bootstrap = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.access_token) {
      setSession(null);
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const meUser = await validateRole(nextSession.access_token);
      setSession(nextSession);
      setUser(meUser);
      setRoleError(null);
      registerPushToken(nextSession.access_token).catch(() => undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in';
      setRoleError(message);
      setSession(null);
      setUser(null);
      await getSupabase().auth.signOut();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      bootstrap(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      bootstrap(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, [bootstrap]);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setRoleError(null);
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      throw error;
    }
    await bootstrap(data.session);
  }, [bootstrap]);

  const signOut = useCallback(async () => {
    setLoading(true);
    await getSupabase().auth.signOut();
    setSession(null);
    setUser(null);
    setRoleError(null);
    setLoading(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      accessToken: session?.access_token ?? null,
      loading,
      roleError,
      signIn,
      signOut,
      clearRoleError: () => setRoleError(null),
    }),
    [session, user, loading, roleError, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
