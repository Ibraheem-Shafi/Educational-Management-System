'use client';

import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
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

interface Student {
  id: string;
  fullName: string;
}

export function LinkStudentDialog({
  open,
  onOpenChange,
  parentId,
  parentName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
  parentName: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [studentId, setStudentId] = useState('');
  const [relationship, setRelationship] = useState('guardian');

  const { data: students } = useQuery({
    queryKey: ['students-parents', parentId],
    queryFn: () => apiClient<PaginatedResponse<Student>>('/students?limit=100', { token }),
    enabled: !!token && open,
  });

  useEffect(() => {
    if (!open) {
      setStudentId('');
      setRelationship('guardian');
    }
  }, [open]);

  const linkMutation = useMutation({
    mutationFn: () =>
      apiClient(`/parents/${parentId}/link-student`, {
        method: 'POST',
        token,
        body: JSON.stringify({ studentId, relationshipCode: relationship }),
      }),
    onSuccess: () => {
      toast.success('Student linked');
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.parentsStats });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-2rem)] gap-0 p-0" aria-describedby={undefined}>
        <div className="flex shrink-0 items-center gap-4 border-b border-[var(--stroke-soft-200,#E2E4E9)] py-4 pl-5 pr-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Link2 className="h-6 w-6 text-[#57646F]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle>Link student</DialogTitle>
            <DialogDescription className="mt-1">
              Connect a student to {parentName}
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

        <form
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onSubmit={(e) => {
            e.preventDefault();
            linkMutation.mutate();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
            <div>
              <FormFieldLabel required>Student</FormFieldLabel>
              <SelectDropdown
                aria-label="Select student"
                placeholder="Select student"
                value={studentId}
                onValueChange={setStudentId}
                options={[
                  { value: '', label: 'Select student' },
                  ...(students?.data.map((s) => ({ value: s.id, label: s.fullName })) ?? []),
                ]}
                className="w-full"
              />
            </div>

            <div>
              <FormFieldLabel required>Relationship</FormFieldLabel>
              <SelectDropdown
                aria-label="Relationship"
                placeholder="Select relationship"
                value={relationship}
                onValueChange={setRelationship}
                options={[
                  { value: 'father', label: 'Father' },
                  { value: 'mother', label: 'Mother' },
                  { value: 'guardian', label: 'Guardian' },
                ]}
                className="w-full"
              />
            </div>
          </div>

          <div className="flex shrink-0 gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-4 pb-5 pt-4">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={linkMutation.isPending}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:bg-[var(--neutral-50)] disabled:opacity-50',
              )}
            >
              Back
            </button>
            <button
              type="submit"
              disabled={linkMutation.isPending || !studentId}
              className={cn(
                'inline-flex h-10 flex-1 items-center justify-center rounded-[10px] bg-[var(--midnight-blue-950,#01366C)] p-[10px]',
                'text-sm font-medium leading-5 tracking-[-0.006em] text-white hover:opacity-90 disabled:opacity-50',
              )}
            >
              {linkMutation.isPending ? 'Linking…' : 'Link student'}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
