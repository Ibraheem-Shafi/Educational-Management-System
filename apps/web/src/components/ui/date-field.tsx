'use client';

import { useEffect, useId, useState, type InputHTMLAttributes } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { isPastYmd, toYmd } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

type DateInputType = 'date' | 'datetime-local';

export type DateFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'value' | 'onChange' | 'defaultValue'
> & {
  value: string;
  onValueChange: (value: string) => void;
  type?: DateInputType;
  /** Visible label above the input (use for From/To ranges in filter bars). */
  label?: string;
  /** When true (default), selecting a past calendar day asks for confirmation. */
  confirmPast?: boolean;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

/**
 * Native date / datetime-local input with optional past-date confirmation.
 * Cancel reverts to the previous committed value.
 */
export function DateField({
  value,
  onValueChange,
  type = 'date',
  label,
  confirmPast = true,
  confirmTitle = 'This is an old date',
  confirmDescription = 'You selected a date in the past. Continue only if you meant to backdate (for example, you forgot to add leave or record something earlier).',
  confirmLabel = 'Use this date',
  cancelLabel = 'Cancel',
  className,
  id,
  disabled,
  ...rest
}: DateFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [draft, setDraft] = useState(value);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!confirmOpen) setDraft(value);
  }, [value, confirmOpen]);

  function commit(next: string) {
    setDraft(next);
    onValueChange(next);
  }

  function handleChange(next: string) {
    if (!confirmPast || !next || !isPastYmd(toYmd(next))) {
      setConfirmOpen(false);
      setPending(null);
      commit(next);
      return;
    }

    // Already accepted this same past value — no second prompt.
    if (toYmd(next) === toYmd(value) && next === value) {
      commit(next);
      return;
    }

    setDraft(next);
    setPending(next);
    setConfirmOpen(true);
  }

  function handleConfirm() {
    if (pending != null) commit(pending);
    setPending(null);
    setConfirmOpen(false);
  }

  function handleCancelConfirm() {
    setPending(null);
    setDraft(value);
    setConfirmOpen(false);
  }

  const input = (
    <input
      {...rest}
      id={inputId}
      type={type}
      disabled={disabled}
      aria-label={rest['aria-label'] ?? label}
      className={cn(className)}
      value={draft}
      onChange={(e) => handleChange(e.target.value)}
    />
  );

  return (
    <>
      {label ? (
        <div className="flex min-w-0 flex-col gap-1">
          <label
            htmlFor={inputId}
            className="text-xs font-medium leading-4 text-[var(--text-sub-500,#525866)]"
          >
            {label}
          </label>
          {input}
        </div>
      ) : (
        input
      )}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={(open) => {
          if (!open) handleCancelConfirm();
        }}
        title={confirmTitle}
        description={confirmDescription}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        onConfirm={handleConfirm}
      />
    </>
  );
}
