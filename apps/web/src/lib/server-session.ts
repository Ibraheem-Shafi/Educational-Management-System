import { createClient } from '@/lib/supabase/server';

export async function getServerAccessToken(): Promise<string | null> {
  try {
    const supabase = await createClient();
    // Prefer getUser() so SSR never hydrates a stale cookie session after
    // logout / account switch (getSession() can return an unverified JWT).
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user) return null;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  } catch {
    return null;
  }
}
