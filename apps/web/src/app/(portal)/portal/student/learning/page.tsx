'use client';

import Link from 'next/link';
import { Suspense, useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight } from 'lucide-react';
import type { LearningResourceResponse, PaginatedResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
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
import { FilterBar } from '@/components/layout/filter-bar';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { StatusBadge, categoryRowClass } from '@/components/layout/status-badge';
import { EmptyStateCell } from '@/components/layout/empty-state';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

type LearningFilterValue = (typeof LEARNING_TYPE_FILTERS)[number]['value'];

const VALID_TYPES = new Set<string>(LEARNING_TYPE_FILTERS.map((f) => f.value));

export default function StudentLearningPage() {
  return (
    <Suspense fallback={<PortalPageSkeleton />}>
      <StudentLearningContent />
    </Suspense>
  );
}

function StudentLearningContent() {
  const { session } = useAuth();
  const token = session?.access_token;
  const searchParams = useSearchParams();
  const initialType = searchParams.get('type');

  const [type, setType] = useState<LearningFilterValue>(
    initialType && VALID_TYPES.has(initialType) ? (initialType as LearningFilterValue) : '',
  );
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (type) queryParams.set('type', type);
  if (search) queryParams.set('search', search);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalStudentLearning({ type, search, page, limit }),
    queryFn: () =>
      apiClient<PaginatedResponse<LearningResourceResponse>>(
        `/portal/student/learning?${queryParams.toString()}`,
        { token },
      ),
    enabled: !!token,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load learning resources.</p>;

  const items = data?.data ?? [];
  const meta = data?.meta;

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={BookOpen}
        title="Learning"
        description="Notes, materials, syllabus, and homework"
      />

      <FilterBar className="items-center">
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

      <ContentPanel title={`Resources (${meta?.total ?? items.length})`}>
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
                <EmptyStateCell colSpan={5} title="No learning resources found" />
              ) : (
                items.map((item) => (
                  <tr key={item.id} className={cn('group', categoryRowClass(item.type))}>
                    <td className={dataTableTdClass}>
                      <Link
                        href={`/portal/student/learning/${item.id}`}
                        className="font-medium text-text-main-900 hover:text-[var(--institution-primary)] hover:underline"
                      >
                        {item.title}
                      </Link>
                      {item.description && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-sub-500)]">
                          {item.description}
                        </p>
                      )}
                      {(item.type === 'online_class' || item.meetingUrl) && (
                        <OnlineClassSessionMeta
                          startsAt={item.startsAt}
                          endsAt={item.endsAt}
                          meetingUrl={item.meetingUrl}
                          isLiveClass={item.type === 'online_class'}
                          variant="inline"
                        />
                      )}
                    </td>
                    <td className={dataTableTdClass}>
                      <StatusBadge label={learningTypeLabel(item.type)} code={item.type} />
                    </td>
                    <td className={dataTableTdClass}>{item.subject?.name ?? '—'}</td>
                    <td className={dataTableTdClass}>
                      {item.type === 'online_class'
                        ? formatLearningDueAt(item.startsAt)
                        : formatLearningDueDate(item.dueAt)}
                    </td>
                    <td className={dataTableTdClass}>
                      <Link
                        href={`/portal/student/learning/${item.id}`}
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
        {meta && (
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
      </ContentPanel>
    </div>
  );
}
