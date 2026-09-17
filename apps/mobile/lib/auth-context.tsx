import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { apiClient } from './api';
import { registerPushToken, unregisterPushToken } from './push';
import { pickAppRole, type AppRole } from './role';
import { getSupabase } from './supabase';
import type { AuthMeResponse, AuthUser } from './types';

interface AuthContextValue {
  session: Session | null;
  user: AuthUser | null;
  appRole: AppRole | null;
  accessToken: string | null;
  loading: boolean;
  roleError: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  clearRoleError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function loadAppUser(accessToken: string): Promise<{ user: AuthUser; role: AppRole }> {
  const me = await apiClient<AuthMeResponse>('/auth/me', { token: accessToken });
  const role = pickAppRole(me.user.roles);
  if (!role) {
    throw new Error('This app is for parents, students, and teachers. Please use the web dashboard.');
  }
  return { user: me.user, role };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [appRole, setAppRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleError, setRoleError] = useState<string | null>(null);

  const bootstrap = useCallback(async (nextSession: Session | null) => {
    if (!nextSession?.access_token) {
      setSession(null);
      setUser(null);
      setAppRole(null);
      setLoading(false);
      return;
    }

    try {
      const loaded = await loadAppUser(nextSession.access_token);
      setSession(nextSession);
      setUser(loaded.user);
      setAppRole(loaded.role);
      setRoleError(null);
      registerPushToken(nextSession.access_token, loaded.role).catch(() => undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in';
      setRoleError(message);
      setSession(null);
      setUser(null);
      setAppRole(null);
      await getSupabase().auth.signOut();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let supabase;
    try {
      supabase = getSupabase();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Auth is not configured');
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      bootstrap(data.session);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      bootstrap(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, [bootstrap]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setLoading(true);
      setRoleError(null);
      const supabase = getSupabase();
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setLoading(false);
        throw error;
      }
      await bootstrap(data.session);
    },
    [bootstrap],
  );

  const resetPassword = useCallback(async (email: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    setLoading(true);
    if (session?.access_token) {
      await unregisterPushToken(session.access_token);
    }
    await getSupabase().auth.signOut();
    setSession(null);
    setUser(null);
    setAppRole(null);
    setRoleError(null);
    setLoading(false);
  }, [session?.access_token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      appRole,
      accessToken: session?.access_token ?? null,
      loading,
      roleError,
      signIn,
      resetPassword,
      signOut,
      clearRoleError: () => setRoleError(null),
    }),
    [session, user, appRole, loading, roleError, signIn, resetPassword, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
