'use client';

import { useCallback, useRef, useState } from 'react';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { isPastYearMonth } from '@/lib/date-utils';

/**
 * Confirm before accepting a year/month in the past (e.g. payroll run period).
 * Returns a prompt helper + the dialog element to render.
 */
export function useConfirmPastPeriod(options?: {
  title?: string;
  description?: string;
  confirmLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<{ year: number; month: number } | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const requestPeriod = useCallback((year: number, month: number) => {
    if (!isPastYearMonth(year, month)) {
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({ year, month });
      setOpen(true);
    });
  }, []);

  function finish(ok: boolean) {
    resolverRef.current?.(ok);
    resolverRef.current = null;
    setPending(null);
    setOpen(false);
  }

  const dialog = (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish(false);
      }}
      title={options?.title ?? 'This is an old period'}
      description={
        options?.description ??
        (pending
          ? `You selected ${pending.year}-${String(pending.month).padStart(2, '0')}, which is before the current month. Continue only if you meant to backdate.`
          : 'You selected a period in the past. Continue only if you meant to backdate.')
      }
      confirmLabel={options?.confirmLabel ?? 'Use this period'}
      cancelLabel="Cancel"
      onConfirm={() => finish(true)}
    />
  );

  return { requestPeriod, dialog };
}
