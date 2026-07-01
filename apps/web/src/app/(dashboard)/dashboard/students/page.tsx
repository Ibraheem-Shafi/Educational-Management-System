'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/layout/page-header';
import { ListRowLink } from '@/components/layout/list-row-link';
import { FilterBar, filterInputClass, filterSelectClass } from '@/components/layout/filter-bar';
import { ListLoadingSkeleton } from '@/components/layout/list-loading-skeleton';

interface StudentRow {
  id: string;
  fullName: string;
  phone: string | null;
  batch?: { name: string };
}

interface Batch {
  id: string;
  name: string;
}

interface LookupStatus {
  id: string;
  label: string;
}

export default function StudentsPage() {
  const { session, user } = useAuth();
  const token = session?.access_token;
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [batchId, setBatchId] = useState('');
  const [statusId, setStatusId] = useState('');
  const [page, setPage] = useState(1);

  const queryParams = new URLSearchParams({ page: String(page), limit: '20' });
  if (search) queryParams.set('search', search);
  if (batchId) queryParams.set('batchId', batchId);
  if (statusId) queryParams.set('statusId', statusId);

  const { data: batches } = useQuery({
    queryKey: ['batches', user?.branchId],
    queryFn: () =>
      apiClient<{ data: Batch[] }>(
        `/batches${user?.branchId ? `?branchId=${user.branchId}` : ''}`,
        { token },
      ),
    enabled: !!token,
  });

  const { data: statuses } = useQuery({
    queryKey: ['lookups', 'student_status'],
    queryFn: () =>
      apiClient<{ statuses: LookupStatus[] }>('/settings/lookups/student_status', { token }),
    enabled: !!token,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['students', search, batchId, statusId, page],
    queryFn: () =>
      apiClient<PaginatedResponse<StudentRow>>(`/students?${queryParams.toString()}`, {
        token,
      }),
    enabled: !!token,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Students"
        description="View and manage student records"
        actions={
          <Button asChild>
            <Link href="/dashboard/students/new">Admit student</Link>
          </Button>
        }
      />

      <FilterBar>
        <Input
          className={filterInputClass}
          placeholder="Search by name"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              setSearch(searchInput.trim());
              setPage(1);
            }
          }}
        />
        <Button
          variant="outline"
          onClick={() => {
            setSearch(searchInput.trim());
            setPage(1);
          }}
        >
          Search
        </Button>
        <select
          className={filterSelectClass}
          value={batchId}
          onChange={(e) => {
            setBatchId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All batches</option>
          {batches?.data.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className={filterSelectClass}
          value={statusId}
          onChange={(e) => {
            setStatusId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {statuses?.statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        {(search || batchId || statusId) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setSearchInput('');
              setBatchId('');
              setStatusId('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
      </FilterBar>

      <Card>
        <CardHeader>
          <CardTitle>All Students ({data?.meta.total ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <ListLoadingSkeleton />}
          {error && <p className="text-red-600">Failed to load students</p>}
          {!isLoading && !error && (
            <>
              <div className="divide-y divide-border">
                {data?.data.length === 0 && (
                  <p className="py-8 text-center text-muted-foreground">No students found</p>
                )}
                {data?.data.map((student) => (
                  <ListRowLink
                    key={student.id}
                    href={`/dashboard/students/${student.id}`}
                    actions={
                      <span className="text-sm text-muted-foreground">
                        {student.batch?.name ?? 'Unassigned'}
                      </span>
                    }
                  >
                    <p className="font-medium">{student.fullName}</p>
                    <p className="text-sm text-muted-foreground">{student.phone ?? '—'}</p>
                  </ListRowLink>
                ))}
              </div>
              {data && data.meta.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {data.meta.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= data.meta.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
