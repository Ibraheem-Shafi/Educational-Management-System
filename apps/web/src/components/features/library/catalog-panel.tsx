'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { PERMISSIONS, libraryCopyStatuses } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import type { PaginatedResponse } from '@eims/types';
import { queryKeys } from '@/lib/query-keys';
import { ContentPanel } from '@/components/layout/content-panel';
import { FilterBar } from '@/components/layout/filter-bar';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { StatusBadge } from '@/components/layout/status-badge';
import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import {
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { cn } from '@/lib/utils';
import { BookDialog } from './book-dialog';
import type { LibraryBook, LibraryCategory } from './types';
import { formatLabel, statusBadgeCode } from './types';

export function CatalogPanel({ branchId }: { branchId: string }) {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canManage = can(PERMISSIONS.LIBRARY_MANAGE);

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBook, setEditBook] = useState<LibraryBook | null>(null);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  const queryParams = {
    branchId,
    page,
    limit,
    ...(categoryFilter ? { categoryId: categoryFilter } : {}),
    ...(search ? { search } : {}),
  };

  const { data: categoriesData } = useQuery({
    queryKey: queryKeys.libraryCategories(branchId, { limit: 100 }),
    queryFn: () =>
      apiClient<PaginatedResponse<LibraryCategory>>(
        `/library/categories?branchId=${branchId}&limit=100`,
        { token },
      ),
    enabled: !!token && !!branchId,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.libraryBooks(branchId, queryParams),
    queryFn: () => {
      const params = new URLSearchParams({
        branchId,
        page: String(page),
        limit: String(limit),
      });
      if (categoryFilter) params.set('categoryId', categoryFilter);
      if (search) params.set('search', search);
      return apiClient<PaginatedResponse<LibraryBook>>(`/library/books?${params.toString()}`, {
        token,
      });
    },
    enabled: !!token && !!branchId,
    placeholderData: (previous) => previous,
  });

  const remove = useMutation({
    mutationFn: (id: string) => apiClient(`/library/books/${id}`, { method: 'DELETE', token }),
    onSuccess: async () => {
      toast.success('Book removed');
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryBooks(branchId) });
      await queryClient.invalidateQueries({ queryKey: queryKeys.libraryStats(branchId) });
    },
    onError: () => toast.error('Unable to remove book'),
  });

  const categories = categoriesData?.data ?? [];
  const rows = data?.data ?? [];

  return (
    <>
      <ContentPanel
        title={`Catalog (${data?.meta.total ?? 0})`}
        actions={
          <PermissionGate permission={PERMISSIONS.LIBRARY_MANAGE}>
            <button type="button" className={pageHeaderActionClassName} onClick={() => setCreateOpen(true)}>
              <PageHeaderActionIcon />
              Add book
            </button>
          </PermissionGate>
        }
      >
        <div className="border-b border-stroke-soft-200 px-5 py-4">
          <FilterBar>
            <SearchInput
              value={search}
              onValueChange={handleSearchChange}
              placeholder="Search title, author, ISBN, accession"
              className="min-w-[220px] flex-1 sm:max-w-xs"
            />
            <SelectDropdown
              aria-label="Category filter"
              placeholder="All categories"
              value={categoryFilter}
              onValueChange={(next) => {
                setCategoryFilter(next);
                setPage(1);
              }}
              options={[
                { value: '', label: 'All categories' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
              className="w-full sm:w-[180px]"
            />
            {(search || categoryFilter) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch('');
                  setCategoryFilter('');
                  setPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </FilterBar>
        </div>

        {error ? (
          <p className="px-5 py-8 text-center text-sm text-red-600">Failed to load catalog</p>
        ) : (
          <>
            <div className={cn(dataTableWrapperClass, 'border-0')}>
              <table className={dataTableClass}>
                <thead>
                  <tr>
                    <th className={dataTableThClass}>Title</th>
                    <th className={dataTableThClass}>Author</th>
                    <th className={dataTableThClass}>Category</th>
                    <th className={dataTableThClass}>Accession</th>
                    <th className={dataTableThClass}>Copies</th>
                    {canManage && <th className={dataTableThClass}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <DataTableSkeletonRows columns={canManage ? 6 : 5} rows={limit} />
                  ) : rows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={canManage ? 6 : 5}
                        className={cn(dataTableTdClass, 'text-center text-[var(--text-sub-500)]')}
                      >
                        No books in catalog
                      </td>
                    </tr>
                  ) : (
                    rows.map((book) => {
                      const copies = book.copies ?? [];
                      const available = copies.filter((c) => c.status === 'available').length;
                      return (
                        <tr key={book.id} className={dataTableRowHoverClass}>
                          <td className={dataTableTdClass}>{book.title}</td>
                          <td className={dataTableTdClass}>{book.author}</td>
                          <td className={dataTableTdClass}>{book.category?.name ?? '—'}</td>
                          <td className={dataTableTdClass}>{book.accessionNo ?? '—'}</td>
                          <td className={dataTableTdClass}>
                            <span className="text-sm">
                              {available}/{copies.length} available
                            </span>
                            {copies.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {copies.map((c) => (
                                  <StatusBadge
                                    key={c.id}
                                    code={statusBadgeCode(c.status)}
                                    label={`${c.copyCode}: ${formatLabel(c.status)}`}
                                  />
                                ))}
                              </div>
                            )}
                          </td>
                          {canManage && (
                            <td className={dataTableTdClass}>
                              <RowActionsMenu
                                items={[
                                  { label: 'Edit', onClick: () => setEditBook(book) },
                                  {
                                    label: 'Delete',
                                    onClick: () => {
                                      if (window.confirm('Remove this book from catalog?')) {
                                        remove.mutate(book.id);
                                      }
                                    },
                                  },
                                ]}
                              />
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {data && (
              <PaginationBar
                page={page}
                totalPages={data.meta.totalPages}
                limit={limit}
                onPageChange={setPage}
                onLimitChange={handleLimitChange}
              />
            )}
          </>
        )}
      </ContentPanel>

      {(createOpen || editBook) && (
        <BookDialog
          open={createOpen || !!editBook}
          onOpenChange={(open) => {
            if (!open) {
              setCreateOpen(false);
              setEditBook(null);
            }
          }}
          branchId={branchId}
          book={editBook}
          categories={categories}
          copyStatuses={[...libraryCopyStatuses]}
        />
      )}
    </>
  );
}
