'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { apiClient } from '@/lib/api-client';
import { getPostLoginPath } from '@/lib/auth-redirect';
import { resolveAdminMfaStep, startMfaChallenge } from '@/lib/mfa';
import { useInstitution } from '@/providers/institution-provider';
import { useAuth } from '@/providers/auth-provider';
import type { AuthUser } from '@eims/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';

const MfaEnrollLogin = dynamic(
  () => import('@/components/auth/mfa-enroll-login').then((m) => ({ default: m.MfaEnrollLogin })),
  { loading: () => <PageContentSkeleton /> },
);

type LoginStep = 'credentials' | 'mfa-enroll' | 'mfa-verify';

export default function LoginPage() {
  const router = useRouter();
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
  }, [authLoading, session, user, step]);

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
      ? 'Set up two-factor authentication'
      : step === 'mfa-verify'
        ? 'Enter your authenticator code'
        : 'Sign in to your account';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--institution-primary)]/10">
            <GraduationCap className="h-6 w-6 text-[var(--institution-primary)]" />
          </div>
          <CardTitle>{name}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          {step === 'mfa-enroll' ? (
            <MfaEnrollLogin onEnrolled={handleEnrolled} />
          ) : step === 'mfa-verify' ? (
            <form onSubmit={handleMfaVerify} className="space-y-4">
              <Input
                placeholder="6-digit code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                maxLength={6}
                required
              />
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Verifying...' : 'Verify'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@institution.pk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>
          )}
          {step === 'credentials' && (
            <p className="mt-4 text-center text-sm">
              <Button variant="link" asChild>
                <Link href="/forgot-password">Forgot password?</Link>
              </Button>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
