'use client';

import { useCallback, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import type { PaginatedResponse, PortalNoticeItem } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { buildPortalQuery } from '@/lib/portal-api';
import { useNoticesRealtime } from '@/hooks/use-notices-realtime';
import { PageHeader } from '@/components/layout/page-header';
import { PortalNoticesSection } from '@/components/portal/portal-notices-section';
import { SearchInput } from '@/components/layout/search-input';
import { FilterBar } from '@/components/layout/filter-bar';

export default function ParentNoticesPage() {
  const { session } = useAuth();
  const token = session?.access_token;
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState('');

  useNoticesRealtime(queryKeys.portalParentNotices({ search }));

  const params = { page, limit, search };
  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalParentNotices(params),
    queryFn: () =>
      apiClient<PaginatedResponse<PortalNoticeItem>>(
        `/portal/parent/notices${buildPortalQuery(params)}`,
        { token },
      ),
    enabled: !!token,
  });

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={Bell} title="Notices" description="School announcements" />
      <FilterBar>
        <SearchInput value={search} onValueChange={handleSearch} placeholder="Search notices…" />
      </FilterBar>
      {isLoading && !data ? (
        <p className="text-sm text-[var(--text-sub-500)]">Loading…</p>
      ) : error ? (
        <p className="text-red-600">Unable to load notices.</p>
      ) : (
        <PortalNoticesSection
          notices={data?.data ?? []}
          page={data?.meta.page}
          totalPages={data?.meta.totalPages}
          onPageChange={setPage}
          limit={limit}
          onLimitChange={(next) => {
            setLimit(next);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
