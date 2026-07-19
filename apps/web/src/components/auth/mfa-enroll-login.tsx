'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { FormFieldError } from '@/components/forms/form-field-error';
import { FormFieldLabel } from '@/components/features/users/invite-form-fields';
import { useFormErrors } from '@/hooks/use-form-errors';
import { totpCodeSchema } from '@/lib/auth-form-schemas';
import { authFieldClassName } from '@/components/auth/auth-shell';

interface MfaEnrollLoginProps {
  onEnrolled: () => void;
}

/** TOTP enrollment UI shown on login when an admin has not yet enrolled MFA. */
export function MfaEnrollLogin({ onEnrolled }: MfaEnrollLoginProps) {
  const [factorId, setFactorId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [verifyCode, setVerifyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const { errors, clearField, validate, fieldClassName } = useFormErrors(totpCodeSchema);

  const startEnroll = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
      if (error) throw error;
      setFactorId(data.id);
      setQrCode(data.totp.qr_code);
      setStarted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start MFA enrollment');
    } finally {
      setLoading(false);
    }
  };

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate({ code: verifyCode })) return;

    setLoading(true);
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
      onEnrolled();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  if (!started) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Admin accounts must enable two-factor authentication before signing in.
        </p>
        <Button type="button" className="w-full" onClick={startEnroll} disabled={loading}>
          {loading ? 'Starting...' : 'Set up authenticator app'}
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={confirmEnroll} className="space-y-4">
      {qrCode && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={qrCode} alt="MFA QR code" className="mx-auto h-40 w-40" />
      )}
      <p className="text-sm text-muted-foreground">
        Scan with your authenticator app, then enter the 6-digit code.
      </p>
      <div>
        <FormFieldLabel required>Authenticator code</FormFieldLabel>
        <Input
          placeholder="6-digit code"
          value={verifyCode}
          onChange={(e) => {
            setVerifyCode(e.target.value);
            clearField('code');
          }}
          maxLength={6}
          className={fieldClassName('code', authFieldClassName)}
        />
        <FormFieldError message={errors.code} />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Verifying...' : 'Verify & continue'}
      </Button>
    </form>
  );
}
