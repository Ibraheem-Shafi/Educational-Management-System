'use client';

import { X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { formatBranchId } from '@/lib/branch-form';

function DeactivateBranchIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 18 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M3 15.75V4.125L9 1.5L15 4.125V15.75H3Z"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <path
        d="M6.75 7.5H11.25M6.75 10.5H11.25"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export interface DeactivateBranchTarget {
  id: string;
  name: string;
  code: string;
}

export function DeactivateBranchDialog({
  branch,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  branch: DeactivateBranchTarget | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  isPending?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0" aria-describedby={undefined}>
        <div className="flex items-start justify-between gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 pb-4 pt-5">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FDECEC]">
              <DeactivateBranchIcon className="h-[18px] w-[18px] text-[#DF1C41]" />
            </div>
            <div className="min-w-0">
              <DialogTitle>Deactivate Branch</DialogTitle>
              <DialogDescription className="mt-1">This action can be reversible</DialogDescription>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)] hover:text-[var(--text-main-900)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4">
          <p className="text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900)]">
            You&apos;re about to deactivate{' '}
            <span className="font-medium">
              {branch?.name ?? 'this branch'} (Branch ID:{' '}
              {branch ? formatBranchId(branch.code) : '—'})
            </span>
            . The branch will be marked inactive until it is reactivated.
          </p>
        </div>

        <div className="flex gap-2 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-5 pb-5 pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
              'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-main-900)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
            )}
          >
            Back
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending || !branch}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[#DF1C41] p-[10px]',
              'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
            )}
          >
            {isPending ? 'Deactivating…' : 'Deactivate Branch'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
