'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { modalFieldClassName, inviteFieldInputClassName } from '@/components/features/users/invite-form-fields';

/** Local mobile digits only (10), stripping leading 92 / 0. */
export function extractPakistanLocalDigits(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('92')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/** Compose E.164 (+92…) from any partial/local/full input; empty → ''. */
export function toPakistanE164(value: string): string {
  const local = extractPakistanLocalDigits(value);
  return local ? `+92${local}` : '';
}

export type PakistanPhoneInputProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value' | 'onChange' | 'inputMode' | 'maxLength'
> & {
  /** Full (+92…), local (03… / 3…), or partial — digits are extracted for display. */
  value: string;
  /** Always emits '' or +92XXXXXXXXXX (up to 10 local digits). */
  onChange: (value: string) => void;
  /** Use modal invite-style chrome (fixed +92 prefix). Default true. */
  withPrefixChrome?: boolean;
};

/**
 * Pakistan mobile input locked to +92. Digits only; onChange emits E.164 or ''.
 */
export const PakistanPhoneInput = React.forwardRef<HTMLInputElement, PakistanPhoneInputProps>(
  (
    {
      className,
      value,
      onChange,
      onPaste,
      onKeyDown,
      withPrefixChrome = true,
      placeholder = '3XX XXXXXXX',
      ...props
    },
    ref,
  ) => {
    const local = extractPakistanLocalDigits(value);

    const handleDigits = (raw: string) => {
      onChange(toPakistanE164(raw));
    };

    const input = (
      <input
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        maxLength={10}
        placeholder={placeholder}
        className={cn(
          withPrefixChrome
            ? cn(inviteFieldInputClassName, 'min-w-0 flex-1 rounded-none px-3')
            : 'flex h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)] disabled:cursor-not-allowed disabled:opacity-50',
          !withPrefixChrome && className,
        )}
        value={local}
        onChange={(e) => handleDigits(e.target.value)}
        onPaste={(e) => {
          onPaste?.(e);
          if (e.defaultPrevented) return;
          e.preventDefault();
          handleDigits(e.clipboardData.getData('text'));
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (e.defaultPrevented) return;
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
          if (e.key.length !== 1) return;
          if (!/^\d$/.test(e.key)) {
            e.preventDefault();
          }
        }}
        {...props}
      />
    );

    if (!withPrefixChrome) {
      return input;
    }

    return (
      <div
        className={cn(
          modalFieldClassName,
          'gap-0 overflow-hidden p-0 focus-within:ring-2 focus-within:ring-[var(--institution-primary)] focus-within:ring-offset-1',
          className,
        )}
      >
        <div
          className="flex h-10 shrink-0 items-center gap-1.5 border-r border-[var(--stroke-soft-200,#E2E4E9)] py-[10px] pl-3 pr-2.5"
          aria-hidden
        >
          <span className="text-base leading-none">🇵🇰</span>
          <span className="text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900)]">
            +92
          </span>
        </div>
        {input}
      </div>
    );
  },
);
PakistanPhoneInput.displayName = 'PakistanPhoneInput';
