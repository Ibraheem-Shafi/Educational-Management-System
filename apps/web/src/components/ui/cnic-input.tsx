'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** Digits only, max 13 (5 + 7 + 1). */
export function extractCnicDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 13);
}

/** Format digits as XXXXX-XXXXXXX-X. */
export function formatCnic(value: string): string {
  const digits = extractCnicDigits(value);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export type CnicInputProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'inputMode' | 'maxLength'
> & {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Pakistan CNIC / B-Form input: digits only, auto-hyphenated to XXXXX-XXXXXXX-X.
 */
export const CnicInput = React.forwardRef<HTMLInputElement, CnicInputProps>(
  ({ className, value, onChange, onPaste, onKeyDown, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={15}
        placeholder="XXXXX-XXXXXXX-X"
        className={cn(
          'flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)] disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        value={formatCnic(value)}
        onChange={(e) => onChange(formatCnic(e.target.value))}
        onPaste={(e) => {
          onPaste?.(e);
          if (e.defaultPrevented) return;
          e.preventDefault();
          const text = e.clipboardData.getData('text');
          onChange(formatCnic(text));
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
          // Allow control/navigation keys; block letters and other non-digit symbols.
          if (e.ctrlKey || e.metaKey || e.altKey) return;
          const allowed = [
            'Backspace',
            'Delete',
            'Tab',
            'Escape',
            'Enter',
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Home',
            'End',
          ];
          if (allowed.includes(e.key)) return;
          if (e.key === '-' || e.key.length !== 1) return;
          if (!/^\d$/.test(e.key)) {
            e.preventDefault();
          }
        }}
        {...props}
      />
    );
  },
);
CnicInput.displayName = 'CnicInput';
