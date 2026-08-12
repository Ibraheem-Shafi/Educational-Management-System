'use client';

import { useRef } from 'react';
import { Download, Paperclip, Trash2, Upload, X } from 'lucide-react';
import { FormFieldLabel } from '@/components/features/users/invite-form-fields';
import { cn } from '@/lib/utils';

export type LearningAttachmentListItem = {
  id: string;
  fileName: string;
  sizeBytes: number | null;
};

function formatSize(bytes: number | null): string {
  if (bytes == null || bytes <= 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function LearningAttachmentsField({
  existing,
  removedIds,
  pendingFiles,
  onAddFiles,
  onRemovePending,
  onRemoveExisting,
  onDownloadExisting,
  downloadingId,
  disabled,
}: {
  existing: LearningAttachmentListItem[];
  removedIds: Set<string>;
  pendingFiles: File[];
  onAddFiles: (files: File[]) => void;
  onRemovePending: (index: number) => void;
  onRemoveExisting: (id: string) => void;
  onDownloadExisting?: (id: string, fileName: string) => void;
  downloadingId?: string | null;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const visibleExisting = existing.filter((a) => !removedIds.has(a.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <FormFieldLabel>Attachments</FormFieldLabel>
        <button
          type="button"
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-md border border-stroke-soft-200 px-3 py-1.5 text-sm',
            'text-text-sub-500 hover:bg-neutral-50 disabled:opacity-50',
          )}
        >
          <Upload className="h-4 w-4" />
          Add files
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.png,.jpg,.jpeg,.webp,.mp4,.webm,.mov,.m4v,video/*,application/pdf"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) onAddFiles(files);
            e.target.value = '';
          }}
        />
      </div>

      {visibleExisting.length === 0 && pendingFiles.length === 0 && (
        <p className="text-sm text-text-sub-500">
          Optional — upload PDFs, docs, images, or video files (mp4, webm, mov) for students.
        </p>
      )}

      {visibleExisting.length > 0 && (
        <ul className="space-y-2">
          {visibleExisting.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-stroke-soft-200 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Paperclip className="h-4 w-4 shrink-0 text-text-sub-500" />
                <div className="min-w-0">
                  <p className="truncate text-text-main-900">{attachment.fileName}</p>
                  {formatSize(attachment.sizeBytes) ? (
                    <p className="text-xs text-text-sub-500">{formatSize(attachment.sizeBytes)}</p>
                  ) : null}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {onDownloadExisting && (
                  <button
                    type="button"
                    disabled={disabled || downloadingId === attachment.id}
                    onClick={() => onDownloadExisting(attachment.id, attachment.fileName)}
                    className="rounded-md p-1.5 text-text-sub-500 hover:bg-neutral-50 hover:text-text-main-900 disabled:opacity-50"
                    aria-label={`Download ${attachment.fileName}`}
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onRemoveExisting(attachment.id)}
                  className="rounded-md p-1.5 text-text-sub-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                  aria-label={`Remove ${attachment.fileName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {pendingFiles.length > 0 && (
        <ul className="space-y-2">
          {pendingFiles.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-stroke-soft-200 bg-neutral-50 px-3 py-2 text-sm"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Upload className="h-4 w-4 shrink-0 text-text-sub-500" />
                <div className="min-w-0">
                  <p className="truncate text-text-main-900">{file.name}</p>
                  <p className="text-xs text-text-sub-500">
                    Ready to upload{formatSize(file.size) ? ` · ${formatSize(file.size)}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onRemovePending(index)}
                className="rounded-md p-1.5 text-text-sub-500 hover:bg-white hover:text-text-main-900 disabled:opacity-50"
                aria-label={`Remove ${file.name}`}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
