'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useInstitution } from '@/providers/institution-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AuthShell,
  authFieldClassName,
  authPrimaryButtonClassName,
} from '@/components/auth/auth-shell';
import { FormFieldLabel } from '@/components/features/users/invite-form-fields';

export default function ForgotPasswordPage() {
  const { name } = useInstitution();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success('Check your email for reset instructions');
  };

  return (
    <AuthShell
      title="Reset password"
      description={`Enter the email linked to your ${name} account and we’ll send a reset link.`}
      footer={
        <p className="text-center text-sm text-[#5B6578]">
          <Link href="/login" className="font-medium text-[#5B2FE0] transition hover:text-[#3B1FA8]">
            Back to sign in
          </Link>
        </p>
      }
    >
      {sent ? (
        <p className="rounded-xl border border-[#E6E8EF] bg-[#F8F9FC] px-4 py-3 text-sm leading-6 text-[#5B6578]">
          If an account exists for <span className="font-medium text-[#0A0D14]">{email}</span>, you
          will receive reset instructions shortly.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <FormFieldLabel required>Email</FormFieldLabel>
            <Input
              type="email"
              placeholder="admin@institution.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className={authFieldClassName}
            />
          </div>
          <Button type="submit" className={authPrimaryButtonClassName} disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
