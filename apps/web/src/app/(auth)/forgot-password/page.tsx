'use client';

import { useState } from 'react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useInstitution } from '@/providers/institution-provider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormFieldLabel,
  modalFieldClassName,
} from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';

const primaryButtonClassName = cn(
  'h-10 w-full rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
  'text-sm font-medium leading-5 tracking-[-0.006em] text-white',
  'hover:bg-[var(--midnight-blue-950,#01366C)] hover:opacity-90',
);

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
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-weak-50,#F6F8FA)] p-4 font-[family-name:var(--font-inter)]">
      <Card className="w-full max-w-md rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white shadow-none">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <GraduationCap className="h-6 w-6 text-[var(--midnight-blue-950,#01366C)]" />
          </div>
          <CardTitle className="font-[family-name:var(--font-inter)] text-[var(--text-main-900,#0A0D14)]">
            {name}
          </CardTitle>
          <CardDescription className="font-[family-name:var(--font-inter)] text-[var(--text-sub-500,#525866)]">
            Reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <p className="text-center text-sm text-[var(--text-sub-500,#525866)]">
              If an account exists for {email}, you will receive reset instructions shortly.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <FormFieldLabel required>Email</FormFieldLabel>
                <Input
                  type="email"
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className={modalFieldClassName}
                />
              </div>
              <Button type="submit" className={primaryButtonClassName} disabled={loading}>
                {loading ? 'Sending...' : 'Send reset link'}
              </Button>
            </form>
          )}
          <p className="mt-4 text-center text-sm">
            <Button
              variant="link"
              asChild
              className="font-[family-name:var(--font-inter)] text-[var(--midnight-blue-950,#01366C)]"
            >
              <Link href="/login">Back to sign in</Link>
            </Button>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
