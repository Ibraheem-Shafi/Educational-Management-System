'use client';

import { useState } from 'react';
import { Download, Paperclip, X } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveRequestResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/layout/status-badge';
import { cn } from '@/lib/utils';

function formatSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LeaveRequestDetailDialog({
  open,
  onOpenChange,
  request,
  personLabel,
  signedUrlPath,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: LeaveRequestResponse | null;
  personLabel: string;
  /** API path prefix for signed URL, e.g. `/leave-requests/${id}` or `/portal/parent/leave/${id}` */
  signedUrlPath?: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [downloading, setDownloading] = useState(false);

  if (!request) return null;

  const download = async () => {
    if (!token || !request.attachmentFileName) return;
    const base = signedUrlPath ?? `/leave-requests/${request.id}`;
    setDownloading(true);
    try {
      const res = await apiClient<{ url: string; fileName?: string }>(
        `${base}/attachment/signed-url`,
        { token },
      );
      const anchor = document.createElement('a');
      anchor.href = res.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.download = res.fileName ?? request.attachmentFileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      toast.error('Unable to download attachment');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0 sm:max-w-lg" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="min-w-0 flex-1">
            <DialogTitle>Leave request</DialogTitle>
            <DialogDescription className="mt-1">
              {personLabel} · {request.fromDate} – {request.toDate}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex items-center gap-2">
            <StatusBadge label={request.status} code={request.status} />
            <span className="text-xs text-[var(--text-sub-500)]">
              {request.kind === 'employee' ? 'Staff' : 'Student'}
            </span>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-sub-500)]">
              Reason
            </p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-main-900)]">
              {request.reason}
            </p>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-[var(--text-sub-500)]">
              Attachment
            </p>
            {request.attachmentFileName ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-stroke-soft-200 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Paperclip className="h-4 w-4 shrink-0 text-[var(--text-sub-500)]" />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-[var(--text-main-900)]">
                      {request.attachmentFileName}
                    </p>
                    {formatSize(request.attachmentSizeBytes) ? (
                      <p className="text-xs text-[var(--text-sub-500)]">
                        {formatSize(request.attachmentSizeBytes)}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void download()}
                  disabled={downloading}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md border border-stroke-soft-200 px-2.5 py-1.5 text-sm',
                    'text-[var(--text-sub-500)] hover:bg-neutral-50 disabled:opacity-50',
                  )}
                >
                  <Download className="h-4 w-4" />
                  {downloading ? 'Opening…' : 'Download'}
                </button>
              </div>
            ) : (
              <p className="text-sm text-[var(--text-sub-500)]">No document attached</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
