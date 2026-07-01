import type { SupabaseClient } from '@supabase/supabase-js';

/** Roles that must enroll TOTP and complete AAL2 at login (docs/12-security.md). */
const MFA_REQUIRED_ROLES = ['super_admin', 'branch_admin'] as const;

export function requiresMfaPolicy(roles: string[]): boolean {
  return roles.some((r) => (MFA_REQUIRED_ROLES as readonly string[]).includes(r));
}

export type AdminMfaStep = 'complete' | 'enroll' | 'verify';

/** Skip admin TOTP for local demos (`NEXT_PUBLIC_SKIP_ADMIN_MFA=1` in apps/web/.env.local). */
export function isDemoMfaSkipped(): boolean {
  return process.env.NEXT_PUBLIC_SKIP_ADMIN_MFA === '1';
}

/** Resolve MFA policy for super_admin / branch_admin after password sign-in. */
export async function resolveAdminMfaStep(
  supabase: SupabaseClient,
  roles: string[],
): Promise<AdminMfaStep> {
  if (!requiresMfaPolicy(roles) || isDemoMfaSkipped()) return 'complete';

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const hasTotp = (factors?.totp?.length ?? 0) > 0;

  if (!hasTotp) return 'enroll';

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === 'aal2' && aal.currentLevel !== 'aal2') return 'verify';

  return 'complete';
}

export async function startMfaChallenge(supabase: SupabaseClient): Promise<{
  factorId: string;
  challengeId: string;
} | null> {
  const { data: factors } = await supabase.auth.mfa.listFactors();
  const totp = factors?.totp?.[0];
  if (!totp) return null;

  const challenge = await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (challenge.error || !challenge.data) return null;

  return { factorId: totp.id, challengeId: challenge.data.id };
}
