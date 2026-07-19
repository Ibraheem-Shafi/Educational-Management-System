'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { Mail, Phone, Users } from 'lucide-react';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import type { PaginatedResponse, StudentsStatsResponse } from '@eims/types';
import { Button } from '@/components/ui/button';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { UserAvatar } from '@/components/layout/user-avatar';
import { StatusBadge } from '@/components/layout/status-badge';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

interface StudentRow {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  gender: string | null;
  cnicOrBForm: string | null;
  photographUrl: string | null;
  batch?: { name: string };
  program?: { name: string };
  branch?: { name: string };
  status?: { code: string; label: string };
}

interface Batch {
  id: string;
  name: string;
}

interface LookupStatus {
  id: string;
  label: string;
}

function formatStudentId(id: string): string {
  return `STD-${id.slice(-6).toUpperCase()}`;
}

function formatGender(gender: string | null): string {
  if (!gender) return '—';
  return gender.charAt(0).toUpperCase() + gender.slice(1);
}

function ContactIcon({
  href,
  label,
  children,
  disabled,
}: {
  href?: string;
  label: string;
  children: ReactNode;
  disabled?: boolean;
}) {
  const className = cn(
    'flex h-8 w-8 items-center justify-center rounded-full border-[0.8px] border-[var(--stroke-soft-200,#E2E4E9)] p-2',
    'text-[var(--text-sub-500,#525866)] transition-colors',
    disabled
      ? 'cursor-not-allowed opacity-40'
      : 'hover:bg-[var(--neutral-50)] hover:text-[var(--text-main-900)]',
  );

  if (disabled || !href) {
    return (
      <span className={className} aria-label={label} title={label}>
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className} aria-label={label} title={label} onClick={(e) => e.stopPropagation()}>
      {children}
    </a>
  );
}

const thClass =
  'h-9 border-0 bg-[#F8F8F8] px-4 text-left text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] first:rounded-l-lg last:rounded-r-lg';
const tdClass =
  'border-0 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-4 py-3 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-main-900,#0A0D14)]';

export default function StudentsPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const canCreate = can(PERMISSIONS.STUDENTS_CREATE);
  // Batch filter requires reading academic data; teachers lack it, so hide the
  // filter (and skip the request) rather than surfacing a 403.
  const canReadBatches = can(PERMISSIONS.ACADEMIC_READ);
  const [search, setSearch] = useState('');
  const [batchId, setBatchId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const { effectiveScope, scopeKey, appendToSearchParams } = useEffectiveBranchScope();

  const queryParams = new URLSearchParams({ page: String(page), limit: String(limit) });
  appendToSearchParams(queryParams);
  if (search) queryParams.set('search', search);
  if (batchId) queryParams.set('batchId', batchId);
  if (statusId) queryParams.set('statusId', statusId);

  const { data: batches } = useQuery({
    queryKey: ['batches', scopeKey],
    queryFn: () =>
      apiClient<{ data: Batch[] }>(withBranchScope('/batches', effectiveScope), { token }),
    enabled: !!token && canReadBatches,
  });

  const { data: statuses } = useQuery({
    queryKey: ['lookups', 'student_status'],
    queryFn: () =>
      apiClient<{ statuses: LookupStatus[] }>('/settings/lookups/student_status', { token }),
    enabled: !!token,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['students', scopeKey, search, batchId, statusId, page, limit],
    queryFn: () =>
      apiClient<PaginatedResponse<StudentRow>>(`/students?${queryParams.toString()}`, {
        token,
      }),
    enabled: !!token,
    retry: 2,
    placeholderData: (previous) => previous,
  });

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.studentsStats, scopeKey],
    queryFn: () =>
      apiClient<StudentsStatsResponse>(withBranchScope('/students/stats', effectiveScope), {
        token,
      }),
    enabled: !!token,
  });

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Users}
        title="Students"
        description="View and manage student records"
        actions={
          canCreate ? (
            <Link href="/dashboard/students/new" className={pageHeaderActionClassName}>
              <PageHeaderActionIcon />
              Admit student
            </Link>
          ) : undefined
        }
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Total Students',
            value: stats?.totalStudents.total ?? 0,
            changePercent: stats?.totalStudents.changePercent,
          },
          {
            label: 'Active Students',
            value: stats?.activeStudents.total ?? 0,
            changePercent: stats?.activeStudents.changePercent,
          },
          {
            label: 'Inactive Students',
            value: stats?.inactiveStudents.total ?? 0,
            changePercent: stats?.inactiveStudents.changePercent,
          },
          {
            label: 'Total Batches',
            value: stats?.totalBatches.total ?? 0,
            changePercent: stats?.totalBatches.changePercent,
          },
        ]}
      />

      <FilterBar className="items-center">
        <SearchInput value={search} onValueChange={handleSearchChange} />
        {canReadBatches && (
          <SelectDropdown
            aria-label="Filter by batch"
            placeholder="All batches"
            value={batchId}
            onValueChange={(next) => {
              setBatchId(next);
              setPage(1);
            }}
            options={[
              { value: '', label: 'All batches' },
              ...(batches?.data.map((b) => ({ value: b.id, label: b.name })) ?? []),
            ]}
          />
        )}
        <SelectDropdown
          aria-label="Filter by status"
          placeholder="All statuses"
          value={statusId}
          onValueChange={(next) => {
            setStatusId(next);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All statuses' },
            ...(statuses?.statuses.map((s) => ({ value: s.id, label: s.label })) ?? []),
          ]}
        />
        {(search || batchId || statusId) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setBatchId('');
              setStatusId('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
        <PageBranchScopeControl />
      </FilterBar>

      <div className="bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th className={thClass}>Student ID</th>
                <th className={thClass}>Student Name</th>
                <th className={thClass}>Email / Phone</th>
                <th className={thClass}>CNIC / B-Form</th>
                <th className={thClass}>Gender</th>
                <th className={thClass}>Branch</th>
                <th className={thClass}>Program</th>
                <th className={thClass}>Status</th>
                <th className={cn(thClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading &&
                Array.from({ length: limit }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className={tdClass}>
                        <div className="h-4 w-16 animate-pulse rounded bg-[var(--neutral-50)]" />
                      </td>
                    ))}
                  </tr>
                ))}

              {error && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load students
                  </td>
                </tr>
              )}

              {!isLoading && !error && data?.data.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                  >
                    No students found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                data?.data.map((student) => (
                  <tr
                    key={student.id}
                    className="transition-colors hover:bg-[var(--neutral-50)]/50"
                  >
                    <td className={cn(tdClass, 'whitespace-nowrap')}>
                      {formatStudentId(student.id)}
                    </td>
                    <td className={tdClass}>
                      <Link
                        href={`/dashboard/students/${student.id}`}
                        className="flex min-w-0 items-center gap-2.5"
                      >
                        <UserAvatar
                          name={student.fullName}
                          src={student.photographUrl}
                          gender={student.gender}
                          seed={student.id}
                          size="sm"
                        />
                        <span className="truncate font-normal text-[var(--text-main-900,#0A0D14)]">
                          {student.fullName}
                        </span>
                      </Link>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-2">
                        <ContactIcon
                          href={student.email ? `mailto:${student.email}` : undefined}
                          label={student.email ?? 'No email'}
                          disabled={!student.email}
                        >
                          <Mail className="h-4 w-4" strokeWidth={1.2} />
                        </ContactIcon>
                        <ContactIcon
                          href={student.phone ? `tel:${student.phone}` : undefined}
                          label={student.phone ?? 'No phone'}
                          disabled={!student.phone}
                        >
                          <Phone className="h-4 w-4" strokeWidth={1.2} />
                        </ContactIcon>
                      </div>
                    </td>
                    <td className={cn(tdClass, 'whitespace-nowrap')}>
                      {student.cnicOrBForm ?? '—'}
                    </td>
                    <td className={tdClass}>{formatGender(student.gender)}</td>
                    <td className={tdClass}>{student.branch?.name ?? '—'}</td>
                    <td className={tdClass}>{student.program?.name ?? '—'}</td>
                    <td className={tdClass}>
                      {student.status ? (
                        <StatusBadge label={student.status.label} code={student.status.code} />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={cn(tdClass, 'text-right')}>
                      <RowActionsMenu
                        items={[
                          { label: 'View details', href: `/dashboard/students/${student.id}` },
                        ]}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {data && (
          <PaginationBar
            page={page}
            totalPages={data.meta.totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(next) => {
              setLimit(next);
              setPage(1);
            }}
          />
        )}
      </div>
    </div>
  );
}
