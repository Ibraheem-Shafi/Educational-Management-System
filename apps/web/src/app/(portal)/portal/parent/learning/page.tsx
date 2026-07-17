'use client';

import Link from 'next/link';
import { Suspense, useCallback, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { LearningResourceResponse, PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import {
  PORTAL_PARENT_KEY,
  type ParentPortalData,
} from '@/lib/portal-types';
import { usePortalChildId } from '@/lib/portal-child-context';
import {
  LEARNING_TYPE_FILTERS,
  formatLearningDueAt,
  formatLearningDueDate,
  learningTypeLabel,
} from '@/lib/portal-learning';
import { OnlineClassSessionMeta } from '@/components/features/learning/online-class-session';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { StatusBadge } from '@/components/layout/status-badge';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

export default function ParentLearningPage() {
  return (
    <Suspense fallback={<PortalPageSkeleton />}>
      <ParentLearningContent />
    </Suspense>
  );
}

function ParentLearningContent() {
  const { session } = useAuth();
  const token = session?.access_token;

  const [type, setType] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: parentData, isLoading: parentLoading } = useQuery({
    queryKey: PORTAL_PARENT_KEY,
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token }),
    enabled: !!token,
  });

  const children = useMemo(() => parentData?.children ?? [], [parentData?.children]);
  const { childId, setChildId } = usePortalChildId(children);
  const childOptions = useMemo(
    () => children.map((c) => ({ value: c.student.id, label: c.student.fullName })),
    [children],
  );

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (childId) queryParams.set('studentId', childId);
  if (type) queryParams.set('type', type);
  if (search) queryParams.set('search', search);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalParentLearning({ studentId: childId, type, search, page, limit }),
    queryFn: () =>
      apiClient<PaginatedResponse<LearningResourceResponse>>(
        `/portal/parent/learning?${queryParams.toString()}`,
        { token },
      ),
    enabled: !!token && !!childId,
  });

  if (parentLoading && !parentData) return <PortalPageSkeleton />;

  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={BookOpen}
        title="Learning"
        description="View notes, materials, and homework for your child"
      />

      {children.length === 0 ? (
        <ContentPanel>
          <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No linked children</p>
        </ContentPanel>
      ) : (
        <>
          <FilterBar className="items-center">
            <SelectDropdown
              value={childId}
              onValueChange={(next) => {
                setPage(1);
                setChildId(next);
              }}
              options={childOptions}
              placeholder="Select child"
              aria-label="Select child"
            />
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search by title…"
            />
            <div className="flex flex-wrap gap-2">
              {LEARNING_TYPE_FILTERS.map((filter) => {
                const active = type === filter.value;
                return (
                  <button
                    key={filter.label}
                    type="button"
                    onClick={() => {
                      setType(filter.value);
                      setPage(1);
                    }}
                    className={cn(
                      'h-9 rounded-lg px-3 text-sm font-medium transition-colors',
                      active
                        ? 'bg-[var(--institution-primary)] text-white'
                        : 'border border-stroke-soft-200 bg-neutral-0 text-text-sub-500 hover:bg-neutral-50',
                    )}
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </FilterBar>

          {error ? (
            <p className="text-red-600">Unable to load learning resources.</p>
          ) : (
            <ContentPanel
              title={`Resources (${meta?.total ?? items.length})`}
            >
              {isLoading && !data ? (
                <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">Loading…</p>
              ) : (
                <>
                  <div className={dataTableWrapperClass}>
                    <table className={cn(dataTableClass, 'min-w-[640px]')}>
                      <thead>
                        <tr>
                          <th className={dataTableThClass}>Title</th>
                          <th className={dataTableThClass}>Type</th>
                          <th className={dataTableThClass}>Subject</th>
                          <th className={dataTableThClass}>Due</th>
                          <th className={dataTableThClass}>
                            <span className="sr-only">Open</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="[&>tr:last-child>td]:border-b-0">
                        {items.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
                              className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]"
                            >
                              No learning resources found
                            </td>
                          </tr>
                        ) : (
                          items.map((item) => (
                            <tr key={item.id} className="group">
                              <td className={dataTableTdClass}>
                                <Link
                                  href={`/portal/parent/learning/${item.id}?childId=${childId}`}
                                  className="font-medium text-text-main-900 hover:text-[var(--institution-primary)] hover:underline"
                                >
                                  {item.title}
                                </Link>
                                {item.description && (
                                  <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-sub-500)]">
                                    {item.description}
                                  </p>
                                )}
                                {item.type === 'online_class' && (
                                  <OnlineClassSessionMeta
                                    startsAt={item.startsAt}
                                    endsAt={item.endsAt}
                                    meetingUrl={item.meetingUrl}
                                    variant="inline"
                                  />
                                )}
                              </td>
                              <td className={dataTableTdClass}>
                                <StatusBadge
                                  label={learningTypeLabel(item.type)}
                                  code={item.type}
                                />
                              </td>
                              <td className={dataTableTdClass}>{item.subject?.name ?? '—'}</td>
                              <td className={dataTableTdClass}>
                                {item.type === 'online_class'
                                  ? formatLearningDueAt(item.startsAt)
                                  : formatLearningDueDate(item.dueAt)}
                              </td>
                              <td className={dataTableTdClass}>
                                <Link
                                  href={`/portal/parent/learning/${item.id}?childId=${childId}`}
                                  className="inline-flex text-icon-primary opacity-60 group-hover:opacity-100"
                                  aria-label={`Open ${item.title}`}
                                >
                                  <ChevronRight className="h-4 w-4" />
                                </Link>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  {meta && meta.totalPages > 1 && (
                    <div className="border-t border-stroke-soft-200 px-5 py-3">
                      <PaginationBar
                        page={meta.page}
                        totalPages={meta.totalPages}
                        onPageChange={setPage}
                        limit={limit}
                        onLimitChange={(next) => {
                          setLimit(next);
                          setPage(1);
                        }}
                      />
                    </div>
                  )}
                </>
              )}
            </ContentPanel>
          )}
        </>
      )}
    </div>
  );
}
