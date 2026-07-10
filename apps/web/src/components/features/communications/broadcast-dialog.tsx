'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Radio, X } from 'lucide-react';
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
import { FormFieldLabel } from '@/components/features/users/invite-form-fields';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

export function BroadcastDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [noticeId, setNoticeId] = useState('');
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('sms');

  const { data: notices } = useQuery({
    queryKey: ['notices-broadcast'],
    queryFn: () =>
      apiClient<{ data: Array<{ id: string; title: string }> }>('/notices?publishedOnly=true', {
        token,
      }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) {
      setNoticeId('');
      setChannel('sms');
    }
  }, [open]);

  const broadcastMutation = useMutation({
    mutationFn: () =>
      apiClient<{ sent: number }>('/communications/notice-broadcast', {
        method: 'POST',
        token,
        body: JSON.stringify({ noticeId, channel, audience: 'parents' }),
      }),
    onSuccess: (res) => {
      toast.success(`Broadcast sent to ${res.sent} recipients`);
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.communicationsStats });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const feeReminderMutation = useMutation({
    mutationFn: () =>
      apiClient<{ sent: number }>('/communications/fee-reminders', {
        method: 'POST',
        token,
        body: JSON.stringify({ channel }),
      }),
    onSuccess: (res) => {
      toast.success(`Sent ${res.sent} fee reminders`);
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.communicationsStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Radio className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Broadcast</DialogTitle>
            <DialogDescription className="mt-1">
              Send bulk messages to parents or fee defaulters
            </DialogDescription>
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

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
          <div>
            <FormFieldLabel required>Channel</FormFieldLabel>
            <SelectDropdown
              aria-label="Channel"
              placeholder="Select channel"
              value={channel}
              onValueChange={(value) => setChannel(value as 'sms' | 'whatsapp')}
              options={[
                { value: 'sms', label: 'SMS' },
                { value: 'whatsapp', label: 'WhatsApp' },
              ]}
              className="w-full"
            />
          </div>

          <button
            type="button"
            onClick={() => feeReminderMutation.mutate()}
            disabled={feeReminderMutation.isPending}
            className={cn(
              'inline-flex h-10 w-full items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
              'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-main-900)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
            )}
          >
            {feeReminderMutation.isPending ? 'Sending…' : 'Send fee reminders to defaulters'}
          </button>

          <div>
            <FormFieldLabel required>Notice to broadcast</FormFieldLabel>
            <SelectDropdown
              aria-label="Select notice"
              placeholder="Select notice"
              value={noticeId}
              onValueChange={setNoticeId}
              options={[
                { value: '', label: 'Select notice' },
                ...(notices?.data.map((n) => ({ value: n.id, label: n.title })) ?? []),
              ]}
              className="w-full"
            />
          </div>
        </div>

        <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={broadcastMutation.isPending}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
              'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
            )}
          >
            Back
          </button>
          <button
            type="button"
            onClick={() => broadcastMutation.mutate()}
            disabled={broadcastMutation.isPending || !noticeId}
            className={cn(
              'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
              'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
            )}
          >
            {broadcastMutation.isPending ? 'Broadcasting…' : 'Broadcast to parents'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
