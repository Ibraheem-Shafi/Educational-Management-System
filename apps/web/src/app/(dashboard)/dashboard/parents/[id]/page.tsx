'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Link2, Mail, Phone, Unlink, Users } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import type { PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PageHeader, pageHeaderActionClassName } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { LinkStudentDialog } from '@/components/features/parents/link-student-dialog';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface ParentDetail {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnic: string | null;
}

interface LinkedStudentRow {
  linkId: string;
  relationshipCode: string;
  student: { id: string; fullName: string };
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-[var(--text-sub-500,#525866)]">{label}</span>
      <span className="text-sm text-[var(--text-main-900,#0A0D14)]">{value || '—'}</span>
    </div>
  );
}

export default function ParentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const { singleBranchId } = useEffectiveBranchScope();
  const canUpdate = can(PERMISSIONS.STUDENTS_UPDATE);
  const [linkOpen, setLinkOpen] = useState(false);
  const [unlinkTarget, setUnlinkTarget] = useState<{ studentId: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const { data: parent, isLoading, error } = useQuery({
    queryKey: ['parents', 'detail', id],
    queryFn: () => apiClient<ParentDetail>(`/parents/${id}`, { token }),
    enabled: !!token && !!id,
  });

  const { data: linkedStudents, isLoading: studentsLoading } = useQuery({
    queryKey: ['parents', id, 'students', page, limit],
    queryFn: () =>
      apiClient<PaginatedResponse<LinkedStudentRow>>(
        `/parents/${id}/students?page=${page}&limit=${limit}`,
        { token },
      ),
    enabled: !!token && !!id,
    placeholderData: (previous) => previous,
  });

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const studentRows = linkedStudents?.data ?? [];
  const studentMeta = linkedStudents?.meta;

  const unlinkMutation = useMutation({
    mutationFn: (studentId: string) =>
      apiClient(`/parents/${id}/students/${studentId}`, { method: 'DELETE', token }),
    onMutate: () => ({ toastId: toast.loading('Unlinking student…') }),
    onSuccess: (_data, _studentId, ctx) => {
      toast.dismiss(ctx?.toastId);
      toast.success('Student unlinked');
      queryClient.invalidateQueries({ queryKey: ['parents'] });
      queryClient.invalidateQueries({ queryKey: ['parents', id, 'students'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.parentsStats });
      setUnlinkTarget(null);
    },
    onError: (err: Error, _studentId, ctx) => {
      toast.dismiss(ctx?.toastId);
      toast.error(err.message);
    },
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <button
        type="button"
        onClick={() => router.push('/dashboard/parents')}
        className="inline-flex items-center gap-1.5 text-sm text-[var(--text-sub-500,#525866)] hover:text-[var(--text-main-900)]"
      >
        <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
        Back to parents
      </button>

      <PageHeader
        icon={Users}
        title={parent?.fullName ?? 'Parent'}
        description={parent ? `Parent ID: ${parent.id.slice(0, 8).toUpperCase()}` : 'Parent details'}
        actions={
          canUpdate && parent ? (
            <button type="button" onClick={() => setLinkOpen(true)} className={pageHeaderActionClassName}>
              <Link2 className="h-4 w-4 shrink-0 text-white" strokeWidth={2} />
              Link student
            </button>
          ) : undefined
        }
      />

      {isLoading && (
        <div className="h-40 animate-pulse rounded-xl bg-[var(--neutral-50)]" />
      )}

      {error && (
        <p className="text-sm text-red-600">Failed to load parent.</p>
      )}

      {parent && (
        <>
          <LinkStudentDialog
            open={linkOpen}
            onOpenChange={setLinkOpen}
            parentId={parent.id}
            parentName={parent.fullName}
            branchId={singleBranchId ?? ''}
          />

          <ConfirmDialog
            open={Boolean(unlinkTarget)}
            onOpenChange={(open) => !open && setUnlinkTarget(null)}
            title="Unlink student?"
            description={
              unlinkTarget ? `${unlinkTarget.name} will be unlinked from ${parent.fullName}.` : undefined
            }
            confirmLabel="Unlink"
            destructive
            loading={unlinkMutation.isPending}
            onConfirm={() => unlinkTarget && unlinkMutation.mutate(unlinkTarget.studentId)}
          />

          <ContentPanel title="Contact information">
            <div className="grid grid-cols-1 gap-4 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
              <InfoRow label="Email" value={parent.email} />
              <InfoRow label="Phone" value={parent.phone} />
              <InfoRow label="CNIC" value={parent.cnic} />
              <InfoRow label="Address" value={parent.address} />
            </div>
          </ContentPanel>

          <div className="flex items-center gap-3">
            <ContactLink href={parent.email ? `mailto:${parent.email}` : undefined} icon={<Mail className="h-4 w-4" strokeWidth={1.5} />} label="Email" />
            <ContactLink href={parent.phone ? `tel:${parent.phone}` : undefined} icon={<Phone className="h-4 w-4" strokeWidth={1.5} />} label="Call" />
          </div>

          <ContentPanel title={`Linked students (${studentMeta?.total ?? studentRows.length})`}>
            <div className={dataTableWrapperClass}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Student</th>
                    <th className={dataTableThClass}>Relationship</th>
                    <th className={cn(dataTableThClass, 'w-12')} />
                  </tr>
                </thead>
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {studentsLoading && studentRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                      >
                        Loading…
                      </td>
                    </tr>
                  )}
                  {!studentsLoading && studentRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-8 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                      >
                        No students linked yet
                      </td>
                    </tr>
                  )}
                  {studentRows.map((link) => (
                    <tr key={link.linkId} className={cn('transition-colors', dataTableRowHoverClass)}>
                      <td className={dataTableTdClass}>{link.student.fullName}</td>
                      <td className={cn(dataTableTdClass, 'capitalize')}>{link.relationshipCode}</td>
                      <td className={cn(dataTableTdClass, 'text-right')}>
                        {canUpdate ? (
                          <RowActionsMenu
                            items={[
                              {
                                label: 'View student',
                                href: `/dashboard/students/${link.student.id}`,
                              },
                              {
                                label: 'Unlink',
                                icon: <Unlink className="h-4 w-4 shrink-0 text-red-500" strokeWidth={1.5} />,
                                onClick: () =>
                                  setUnlinkTarget({
                                    studentId: link.student.id,
                                    name: link.student.fullName,
                                  }),
                              },
                            ]}
                          />
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {studentMeta && studentMeta.totalPages > 0 && (
              <PaginationBar
                page={page}
                totalPages={studentMeta.totalPages}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={handleLimitChange}
              />
            )}
          </ContentPanel>
        </>
      )}
    </div>
  );
}

function ContactLink({
  href,
  icon,
  label,
}: {
  href?: string;
  icon: React.ReactNode;
  label: string;
}) {
  const className = cn(
    'inline-flex h-9 items-center gap-2 rounded-[10px] border border-[var(--stroke-soft-200,#E2E4E9)] px-3 text-sm',
    href
      ? 'text-[var(--text-main-900)] hover:bg-[var(--neutral-50)]'
      : 'cursor-not-allowed text-[var(--text-sub-500,#525866)] opacity-40',
  );
  if (!href) {
    return (
      <span className={className}>
        {icon}
        {label}
      </span>
    );
  }
  return (
    <a href={href} className={className}>
      {icon}
      {label}
    </a>
  );
}
