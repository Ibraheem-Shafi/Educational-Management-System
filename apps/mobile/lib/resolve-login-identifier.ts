import { apiClient, ApiError } from '@/lib/api';

/** Resolve phone or email to the account email used by Supabase Auth. */
export async function resolveLoginIdentifier(identifier: string): Promise<string> {
  const trimmed = identifier.trim();
  const result = await apiClient<{ email: string }>('/auth/resolve-login-identifier', {
    method: 'POST',
    body: { identifier: trimmed },
  });
  return result.email;
}

export function loginLookupError(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return 'Could not look up that email or phone';
}
