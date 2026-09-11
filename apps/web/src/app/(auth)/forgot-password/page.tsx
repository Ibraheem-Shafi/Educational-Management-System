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
import { FormFieldError } from '@/components/forms/form-field-error';
import { useFormErrors } from '@/hooks/use-form-errors';
import { forgotPasswordFormSchema } from '@/lib/auth-form-schemas';

export default function ForgotPasswordPage() {
  const { name } = useInstitution();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { errors, clearField, validate, fieldClassName } = useFormErrors(forgotPasswordFormSchema);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate({ email: email.trim() })) return;

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
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
          <Link href="/login" className="font-medium text-[var(--palette-teal)] transition hover:text-[var(--palette-navy)]">
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
              onChange={(e) => {
                setEmail(e.target.value);
                clearField('email');
              }}
              className={fieldClassName('email', authFieldClassName)}
            />
            <FormFieldError message={errors.email} />
          </div>
          <Button type="submit" className={authPrimaryButtonClassName} disabled={loading}>
            {loading ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
