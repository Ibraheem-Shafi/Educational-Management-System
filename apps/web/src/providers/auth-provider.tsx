'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { SupabaseClient, Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { apiClient, ApiClientError } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { referenceQueryOptions } from '@/providers/query-provider';
import {
  E2E_MOCK_SESSION,
  E2E_MOCK_USER,
  isE2eAuthBypass,
  readE2eMockUserOverride,
} from '@/lib/e2e-auth';
import type { AuthUser } from '@eims/types';

interface AuthContextValue {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
  /** Called after login /me so guards have session + profile before navigation. */
  syncAuth: (session: Session, profile: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
  syncAuth: () => {},
});

export function AuthProvider({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: AuthUser | null;
}) {
  const e2eBypass = isE2eAuthBypass();
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(e2eBypass ? E2E_MOCK_SESSION : null);
  const [user, setUser] = useState<AuthUser | null>(
    e2eBypass ? E2E_MOCK_USER : initialUser,
  );
  const [loading, setLoading] = useState(!e2eBypass && !initialUser);
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const meRequestId = useRef(0);
  const loadedTokenRef = useRef<string | null>(null);
  const inflightMe = useRef<Promise<AuthUser | null> | null>(null);
  const userSupabaseIdRef = useRef<string | null>(
    e2eBypass ? E2E_MOCK_USER.supabaseUserId : (initialUser?.supabaseUserId ?? null),
  );

  useEffect(() => {
    userSupabaseIdRef.current = user?.supabaseUserId ?? null;
  }, [user?.supabaseUserId]);

  useEffect(() => {
    if (e2eBypass) {
      // Apply a test-provided user override (e.g. super admin) after mount.
      const override = readE2eMockUserOverride();
      if (override) setUser(override);
      return;
    }
    setSupabase(createClient());
  }, [e2eBypass]);

  useEffect(() => {
    if (e2eBypass || !supabase) return;

    const loadUser = async (accessToken: string): Promise<void> => {
      if (loadedTokenRef.current === accessToken) return;

      if (inflightMe.current) {
        await inflightMe.current;
        if (loadedTokenRef.current === accessToken) return;
      }

      const requestId = ++meRequestId.current;

      const promise = apiClient<{ user: AuthUser }>('/auth/me', { token: accessToken })
        .then((me) => ({ profile: me.user, unauthorized: false as const }))
        .catch((err: unknown) => ({
          profile: null,
          unauthorized:
            err instanceof ApiClientError &&
            (err.statusCode === 401 || err.statusCode === 403),
        }));

      const profilePromise = promise.then((r) => r.profile);
      inflightMe.current = profilePromise;

      try {
        const { profile, unauthorized } = await promise;
        if (requestId !== meRequestId.current) return;

        if (profile) {
          loadedTokenRef.current = accessToken;
          setUser(profile);
          void queryClient.prefetchQuery({
            queryKey: queryKeys.branches,
            queryFn: () => apiClient<{ data: unknown[] }>('/branches/options', { token: accessToken }),
            ...referenceQueryOptions(),
          });
        } else {
          loadedTokenRef.current = null;
          setUser(null);
          if (unauthorized) {
            await supabase.auth.signOut({ scope: 'local' });
          }
        }
      } finally {
        if (inflightMe.current === profilePromise) {
          inflightMe.current = null;
        }
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, s) => {
      setSession(s);

      if (s?.access_token && s.user?.id) {
        const sessionUserId = s.user.id;
        // Only skip /auth/me when SSR profile is for *this* session subject.
        // Never bind a new access token to a different user's hydrated profile
        // (common after logout → login as another account on Vercel).
        const ssrMatchesSession =
          !!initialUser && initialUser.supabaseUserId === sessionUserId;

        if (ssrMatchesSession && loadedTokenRef.current !== s.access_token) {
          loadedTokenRef.current = s.access_token;
          setUser(initialUser);
          setLoading(false);
        } else if (s.access_token !== loadedTokenRef.current) {
          await loadUser(s.access_token);
        } else if (
          userSupabaseIdRef.current &&
          userSupabaseIdRef.current !== sessionUserId
        ) {
          loadedTokenRef.current = null;
          await loadUser(s.access_token);
        }
      } else {
        meRequestId.current += 1;
        loadedTokenRef.current = null;
        inflightMe.current = null;
        setUser(null);
      }

      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [e2eBypass, supabase, queryClient, initialUser]);

  const signOut = useCallback(async () => {
    queryClient.clear();
    meRequestId.current += 1;
    loadedTokenRef.current = null;
    inflightMe.current = null;
    setUser(null);
    setSession(null);
    setLoading(false);
    if (e2eBypass) return;
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  }, [e2eBypass, supabase, queryClient]);

  const syncAuth = useCallback(
    (nextSession: Session, profile: AuthUser) => {
      queryClient.clear();
      loadedTokenRef.current = nextSession.access_token;
      setSession(nextSession);
      setUser(profile);
      setLoading(false);
    },
    [queryClient],
  );

  const value = useMemo(
    () => ({ session, user, loading, signOut, syncAuth }),
    [session, user, loading, signOut, syncAuth],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
