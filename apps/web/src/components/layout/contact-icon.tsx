'use client';

import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ContactKind = 'email' | 'phone';

const COPY_TOAST: Record<ContactKind, string> = {
  email: 'Email copied',
  phone: 'Phone number copied',
};

export function ContactIcon({
  kind,
  value,
  children,
  disabled,
}: {
  kind: ContactKind;
  value?: string | null;
  children: ReactNode;
  disabled?: boolean;
}) {
  const hasValue = Boolean(value?.trim());
  const isDisabled = disabled || !hasValue;
  const displayLabel = hasValue ? value! : kind === 'email' ? 'No email' : 'No phone';

  const className = cn(
    'flex h-8 w-8 items-center justify-center rounded-full border-[0.8px] p-2',
    'transition-colors',
    kind === 'email'
      ? 'border-[var(--palette-teal)]/20 bg-[var(--palette-teal-soft)] text-[var(--palette-teal)]'
      : 'border-[var(--palette-orange)]/20 bg-[var(--palette-orange-soft)] text-[var(--palette-orange)]',
    isDisabled
      ? 'cursor-not-allowed opacity-40'
      : kind === 'email'
        ? 'hover:bg-[var(--palette-teal)] hover:text-white'
        : 'hover:bg-[var(--palette-orange)] hover:text-white',
  );

  if (isDisabled) {
    return (
      <span className={className} aria-label={displayLabel} title={displayLabel}>
        {children}
      </span>
    );
  }

  return (
    <button
      type="button"
      className={className}
      aria-label={`Copy ${displayLabel}`}
      title={`${displayLabel} (click to copy)`}
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard.writeText(value!.trim()).then(
          () => toast.success(COPY_TOAST[kind]),
          () => toast.error('Could not copy'),
        );
      }}
    >
      {children}
    </button>
  );
}
