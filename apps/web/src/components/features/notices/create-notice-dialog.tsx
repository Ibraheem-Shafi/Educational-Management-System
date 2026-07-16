'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Megaphone, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const emptyForm = {
  title: '',
  body: '',
  audience: 'all',
  publishAt: '',
};

export function CreateNoticeDialog({
  open,
  onOpenChange,
  branchId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!open) setForm(emptyForm);
  }, [open]);

  const isScheduling = Boolean(form.publishAt.trim());

  const createMutation = useMutation({
    mutationFn: () => {
      const publishedAt = form.publishAt.trim()
        ? new Date(form.publishAt).toISOString()
        : undefined;
      if (publishedAt && Number.isNaN(new Date(publishedAt).getTime())) {
        throw new Error('Invalid publish date/time');
      }
      if (publishedAt && new Date(publishedAt).getTime() <= Date.now()) {
        throw new Error('Publish schedule must be in the future');
      }

      return apiClient('/notices', {
        method: 'POST',
        token,
        body: JSON.stringify({
          branchId,
          title: form.title,
          body: form.body,
          audience: form.audience,
          ...(publishedAt ? { publishedAt } : {}),
        }),
      });
    },
    onSuccess: () => {
      toast.success(isScheduling ? 'Notice scheduled' : 'Notice created');
      queryClient.invalidateQueries({ queryKey: ['notices'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.noticesStats });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const canSubmit = form.title.trim() && form.body.trim() && branchId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Megaphone className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Create notice</DialogTitle>
            <DialogDescription className="mt-1">Draft an announcement for staff and portals</DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[var(--text-sub-500)] hover:bg-[var(--neutral-50)] hover:text-[var(--text-main-900)]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            createMutation.mutate();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Title</FormFieldLabel>
              <input
                className={modalFieldClassName}
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            <div>
              <FormFieldLabel required>Body</FormFieldLabel>
              <textarea
                className={cn(modalFieldClassName, 'min-h-[120px] resize-y py-3')}
                placeholder="Body"
                value={form.body}
                onChange={(e) => setForm((prev) => ({ ...prev, body: e.target.value }))}
                required
              />
            </div>

            <div>
              <FormFieldLabel required>Audience</FormFieldLabel>
              <SelectDropdown
                aria-label="Audience"
                placeholder="Select audience"
                value={form.audience}
                onValueChange={(value) => setForm((prev) => ({ ...prev, audience: value }))}
                options={[
                  { value: 'all', label: 'Everyone' },
                  { value: 'parents', label: 'Parents' },
                  { value: 'students', label: 'Students' },
                  { value: 'staff', label: 'Staff' },
                  { value: 'teachers', label: 'Teachers' },
                ]}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel>Publish at</FormFieldLabel>
              <input
                type="datetime-local"
                className={modalFieldClassName}
                value={form.publishAt}
                onChange={(e) => setForm((prev) => ({ ...prev, publishAt: e.target.value }))}
                aria-label="Publish at"
              />
              <p className="mt-1.5 text-xs text-[var(--text-sub-500,#525866)]">
                Leave empty to save as a draft. Set a future date to schedule publishing.
              </p>
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={createMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending || !canSubmit}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {createMutation.isPending
                ? 'Saving…'
                : isScheduling
                  ? 'Schedule notice'
                  : 'Save draft'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
