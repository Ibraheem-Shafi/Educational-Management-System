'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, X } from 'lucide-react';
import { sendMessageSchema, normalizePakistanPhone } from '@eims/shared';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { handleFormValidationError } from '@/lib/form-api-error';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FormFieldLabel, modalFieldClassName } from '@/components/features/users/invite-form-fields';
import { FormFieldError } from '@/components/forms/form-field-error';
import { PakistanPhoneInput } from '@/components/ui/pakistan-phone-input';
import { useFormErrors } from '@/hooks/use-form-errors';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const emptyForm = {
  channel: 'sms' as 'sms' | 'whatsapp',
  recipient: '',
  body: '',
};

export function SendMessageDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const { errors, clearField, validate, applyApiErrors, fieldClassName, clearAll } =
    useFormErrors(sendMessageSchema);

  useEffect(() => {
    if (!open) {
      setForm(emptyForm);
      clearAll();
    }
  }, [open, clearAll]);

  const sendMutation = useMutation({
    mutationFn: (payload: typeof emptyForm) =>
      apiClient('/communications/send', {
        method: 'POST',
        token,
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      toast.success('Message queued');
      queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.communicationsStats });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      if (handleFormValidationError(err, applyApiErrors)) return;
      toast.error(err.message);
    },
  });

  const updateField = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    clearField(key);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <MessageSquare className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Send message</DialogTitle>
            <DialogDescription className="mt-1">Send an SMS or WhatsApp message</DialogDescription>
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
            const payload = {
              channel: form.channel,
              recipient: normalizePakistanPhone(form.recipient.trim()),
              body: form.body.trim(),
            };
            if (!validate(payload)) return;
            sendMutation.mutate(payload);
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Channel</FormFieldLabel>
              <SelectDropdown
                aria-label="Channel"
                placeholder="Select channel"
                value={form.channel}
                onValueChange={(value) => updateField('channel', value as 'sms' | 'whatsapp')}
                options={[
                  { value: 'sms', label: 'SMS' },
                  { value: 'whatsapp', label: 'WhatsApp' },
                ]}
                className="w-full"
              />
              <FormFieldError message={errors.channel} />
            </div>

            <div>
              <FormFieldLabel required>Recipient phone</FormFieldLabel>
              <PakistanPhoneInput
                value={form.recipient}
                onChange={(value) => updateField('recipient', value)}
                className={errors.recipient ? 'border-red-500' : undefined}
              />
              <FormFieldError message={errors.recipient} />
            </div>

            <div>
              <FormFieldLabel required>Message body</FormFieldLabel>
              <textarea
                className={cn(fieldClassName('body', modalFieldClassName), 'min-h-[100px] resize-y py-3')}
                placeholder="Message body"
                value={form.body}
                onChange={(e) => updateField('body', e.target.value)}
              />
              <FormFieldError message={errors.body} />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={sendMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={sendMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {sendMutation.isPending ? 'Sending…' : 'Send'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
