'use client';

import dynamic from 'next/dynamic';
import { Suspense, useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';
import { getPostLoginPath } from '@/lib/auth-redirect';
import { getLoginErrorMessage, isPortalDisabledLoginError } from '@/lib/login-errors';
import { resolveAdminMfaStep, startMfaChallenge } from '@/lib/mfa';
import { useInstitution } from '@/providers/institution-provider';
import { useAuth } from '@/providers/auth-provider';
import type { AuthUser } from '@eims/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';
import {
  AuthShell,
  authFieldClassName,
  authPrimaryButtonClassName,
} from '@/components/auth/auth-shell';
import { FormFieldLabel } from '@/components/features/users/invite-form-fields';

const MfaEnrollLogin = dynamic(
  () => import('@/components/auth/mfa-enroll-login').then((m) => ({ default: m.MfaEnrollLogin })),
  { loading: () => <PageContentSkeleton /> },
);

type LoginStep = 'credentials' | 'mfa-enroll' | 'mfa-verify';

export default function LoginPage() {
  return (
    <Suspense fallback={<PageContentSkeleton />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorCode = searchParams.get('error');
  const errorMessage = getLoginErrorMessage(errorCode);
  const portalDisabled = isPortalDisabledLoginError(errorCode);
  const navigatedRef = useRef(false);
  const { name } = useInstitution();
  const { session, user, loading: authLoading, syncAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<LoginStep>('credentials');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  const finishLogin = (roles: string[]) => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    toast.success('Welcome back');
    router.replace(getPostLoginPath(roles));
  };

  useEffect(() => {
    if (portalDisabled) return;
    if (authLoading || !session?.access_token || !user || step !== 'credentials') return;

    const resume = async () => {
      const mfaStep = await resolveAdminMfaStep(createClient(), user.roles);
      if (mfaStep === 'complete') {
        finishLogin(user.roles);
        return;
      }
      if (mfaStep === 'enroll') {
        setStep('mfa-enroll');
        return;
      }
      const challenge = await startMfaChallenge(createClient());
      if (challenge) {
        setMfaFactorId(challenge.factorId);
        setChallengeId(challenge.challengeId);
        setStep('mfa-verify');
      }
    };

    void resume();
  }, [authLoading, session, user, step, portalDisabled]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error('Invalid email or password');
      return;
    }

    const accessToken = authData.session?.access_token;
    if (!authData.session || !accessToken) {
      setLoading(false);
      toast.error('Sign-in failed');
      return;
    }

    let roles: string[] = [];
    try {
      const me = await apiClient<{ user: AuthUser }>('/auth/me', { token: accessToken });
      syncAuth(authData.session, me.user);
      roles = me.user.roles;
    } catch {
      setLoading(false);
      toast.error('Could not load account');
      return;
    }

    const mfaStep = await resolveAdminMfaStep(supabase, roles);
    if (mfaStep === 'enroll') {
      setStep('mfa-enroll');
      setLoading(false);
      return;
    }

    if (mfaStep === 'verify') {
      const challenge = await startMfaChallenge(supabase);
      if (!challenge) {
        setLoading(false);
        toast.error('Could not start MFA verification');
        return;
      }
      setMfaFactorId(challenge.factorId);
      setChallengeId(challenge.challengeId);
      setStep('mfa-verify');
      setLoading(false);
      return;
    }

    finishLogin(roles);
    setLoading(false);
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const verify = await supabase.auth.mfa.verify({
      factorId: mfaFactorId,
      challengeId,
      code: mfaCode,
    });
    if (verify.error) {
      setLoading(false);
      toast.error('Invalid verification code');
      return;
    }
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.access_token) {
      try {
        const me = await apiClient<{ user: AuthUser }>('/auth/me', {
          token: sessionData.session.access_token,
        });
        syncAuth(sessionData.session, me.user);
        finishLogin(me.user.roles);
      } catch {
        toast.error('Could not load account');
      }
    }
    setLoading(false);
  };

  const handleEnrolled = async () => {
    setLoading(true);
    const supabase = createClient();
    const challenge = await startMfaChallenge(supabase);
    if (!challenge) {
      setLoading(false);
      toast.error('Enrollment succeeded but verification could not start');
      return;
    }
    setMfaFactorId(challenge.factorId);
    setChallengeId(challenge.challengeId);
    setStep('mfa-verify');
    setMfaCode('');
    setLoading(false);
  };

  const description =
    step === 'mfa-enroll'
      ? 'Set up two-factor authentication to continue'
      : step === 'mfa-verify'
        ? 'Enter the 6-digit code from your authenticator app'
        : `Sign in to ${name}`;

  return (
    <AuthShell
      title={step === 'credentials' ? 'Welcome back' : step === 'mfa-enroll' ? 'Secure your account' : 'Verify it’s you'}
      description={description}
      footer={
        step === 'credentials' ? (
          <p className="text-center text-sm text-[#5B6578]">
            <Link
              href="/forgot-password"
              className="font-medium text-[#5B2FE0] transition hover:text-[#3B1FA8]"
            >
              Forgot password?
            </Link>
          </p>
        ) : null
      }
    >
      {errorMessage && (
        <div
          role="alert"
          className="mb-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-3.5 py-3 text-sm leading-5 text-[#991B1B]"
        >
          {errorMessage}
        </div>
      )}

      {step === 'mfa-enroll' ? (
        <MfaEnrollLogin onEnrolled={handleEnrolled} />
      ) : step === 'mfa-verify' ? (
        <form onSubmit={handleMfaVerify} className="space-y-5">
          <div>
            <FormFieldLabel required>Authenticator code</FormFieldLabel>
            <Input
              placeholder="6-digit code"
              value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value)}
              maxLength={6}
              required
              className={authFieldClassName}
            />
          </div>
          <Button type="submit" className={authPrimaryButtonClassName} disabled={loading}>
            {loading ? 'Verifying…' : 'Verify'}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <FormFieldLabel required>Email</FormFieldLabel>
            <Input
              id="email"
              type="email"
              placeholder="admin@institution.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={authFieldClassName}
            />
          </div>
          <div>
            <FormFieldLabel required>Password</FormFieldLabel>
            <PasswordInput
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className={authFieldClassName}
            />
          </div>
          <Button type="submit" className={authPrimaryButtonClassName} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
