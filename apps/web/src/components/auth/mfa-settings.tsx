'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { requiresMfaPolicy } from '@/lib/mfa';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/providers/auth-provider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export function MfaSettings() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const adminMfaLocked = user ? requiresMfaPolicy(user.roles) : false;
  const [enrolling, setEnrolling] = useState(false);
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');

  const { data: factors, refetch } = useQuery({
    queryKey: ['mfa-factors'],
    queryFn: async () => {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      return data;
    },
  });

  const hasTotp = (factors?.totp?.length ?? 0) > 0;

  const startEnroll = async () => {
    setEnrolling(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start MFA enrollment');
      setEnrolling(false);
    }
  };

  const confirmEnroll = async () => {
    try {
      const supabase = createClient();
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) throw challenge.error;
      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode,
      });
      if (verify.error) throw verify.error;
      toast.success('Two-factor authentication enabled');
      setEnrolling(false);
      setVerifyCode('');
      setQrCode('');
      void refetch();
      queryClient.invalidateQueries({ queryKey: ['mfa-factors'] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid verification code');
    }
  };

  const unenroll = async (id: string) => {
    if (adminMfaLocked) {
      toast.error('MFA cannot be disabled for admin accounts');
      return;
    }
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
      if (error) throw error;
      toast.success('MFA disabled');
      void refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to disable MFA');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Two-factor authentication</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasTotp ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              TOTP is enabled on your account.
              {adminMfaLocked && ' Required for admin accounts.'}
            </p>
            {!adminMfaLocked &&
              factors?.totp.map((f) => (
                <Button key={f.id} variant="outline" size="sm" onClick={() => unenroll(f.id)}>
                  Disable MFA
                </Button>
              ))}
          </div>
        ) : enrolling ? (
          <div className="space-y-3">
            {qrCode && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrCode} alt="MFA QR code" className="h-40 w-40" />
            )}
            <p className="text-sm text-muted-foreground">
              Scan with your authenticator app, then enter the 6-digit code.
            </p>
            <Input
              placeholder="000000"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              maxLength={6}
            />
            <Button onClick={confirmEnroll} disabled={verifyCode.length < 6}>
              Verify & enable
            </Button>
          </div>
        ) : (
          <Button onClick={startEnroll}>Enable authenticator app (TOTP)</Button>
        )}
      </CardContent>
    </Card>
  );
}
