'use client';

import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { withBranchScope } from '@/lib/branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import type { DocumentsStatsResponse, PaginatedResponse } from '@eims/types';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  PageHeader,
  PageHeaderActionIcon,
  pageHeaderActionClassName,
} from '@/components/layout/page-header';
import { MainStatsSection } from '@/components/layout/main-stats-section';
import { SearchInput } from '@/components/layout/search-input';
import { SelectDropdown } from '@/components/layout/select-dropdown';
import { FilterBar } from '@/components/layout/filter-bar';
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { UploadDocumentDialog } from '@/components/features/documents/upload-document-dialog';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { categoryRowClass } from '@/components/layout/status-badge';
import { EmptyStateCell } from '@/components/layout/empty-state';
import { DataTableSkeletonRows } from '@/components/layout/data-table-skeleton';
import { queryKeys } from '@/lib/query-keys';
import { cn } from '@/lib/utils';

const CATEGORIES = [
  { value: 'admission_form', label: 'Admission form' },
  { value: 'b_form', label: 'B-Form' },
  { value: 'cnic', label: 'CNIC' },
  { value: 'fee_receipt', label: 'Fee receipt' },
  { value: 'academic_record', label: 'Academic record' },
  { value: 'other', label: 'Other' },
] as const;

interface DocumentRow {
  id: string;
  title: string;
  category: string;
  createdAt: string;
  student?: { fullName: string } | null;
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export default function DocumentsPage() {
  const { session } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canUpload = can(PERMISSIONS.DOCUMENTS_UPLOAD);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [deleteTarget, setDeleteTarget] = useState<DocumentRow | null>(null);

  const { effectiveScope, scopeKey, singleBranchId, appendToSearchParams } =
    useEffectiveBranchScope();

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: [...queryKeys.documentsStats, scopeKey],
    queryFn: () =>
      apiClient<DocumentsStatsResponse>(withBranchScope('/documents/stats', effectiveScope), {
        token,
      }),
    enabled: !!token,
  });

  const queryString = (() => {
    const p = new URLSearchParams();
    appendToSearchParams(p);
    if (search) p.set('search', search);
    if (category) p.set('category', category);
    p.set('page', String(page));
    p.set('limit', String(limit));
    return p.toString();
  })();

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['documents', scopeKey, search, category, page, limit],
    queryFn: () => apiClient<PaginatedResponse<DocumentRow>>(`/documents?${queryString}`, { token }),
    enabled: !!token,
    placeholderData: (previous) => previous,
  });

  const rows = documents?.data ?? [];

  const openDocument = async (id: string) => {
    const t = toast.loading('Opening document…');
    try {
      const res = await apiClient<{ url: string }>(`/documents/${id}/signed-url`, { token });
      toast.dismiss(t);
      window.open(res.url, '_blank');
    } catch (err) {
      toast.dismiss(t);
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/documents/${id}`, { method: 'DELETE', token }),
    onMutate: () => ({ toastId: toast.loading('Deleting document…') }),
    onSuccess: (_data, _id, ctx) => {
      toast.dismiss(ctx?.toastId);
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.documentsStats });
      setDeleteTarget(null);
    },
    onError: (err: Error, _id, ctx) => {
      toast.dismiss(ctx?.toastId);
      toast.error(err.message);
    },
  });

  const handleLimitChange = useCallback((next: number) => {
    setLimit(next);
    setPage(1);
  }, []);

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={FileText}
        title="Documents"
        description="Student files and records"
        actions={
          canUpload ? (
            <button
              type="button"
              onClick={() => setUploadOpen(true)}
              className={pageHeaderActionClassName}
            >
              <PageHeaderActionIcon />
              Upload document
            </button>
          ) : undefined
        }
      />

      {canUpload && (
        <UploadDocumentDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          branchId={singleBranchId ?? ''}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete document?"
        description={
          deleteTarget
            ? `"${deleteTarget.title}" will be removed. This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        loading={deleteMutation.isPending}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />

      <MainStatsSection
        isLoading={statsLoading}
        stats={[
          {
            label: 'Total files',
            value: formatCount(stats?.totalFiles.total ?? 0),
            changePercent: stats?.totalFiles.changePercent,
          },
          {
            label: 'Recent uploads',
            value: formatCount(stats?.recentUploads.total ?? 0),
            changePercent: stats?.recentUploads.changePercent,
          },
          {
            label: 'Student documents',
            value: formatCount(stats?.studentDocuments.total ?? 0),
            changePercent: stats?.studentDocuments.changePercent,
          },
          {
            label: 'Other documents',
            value: formatCount(stats?.otherDocuments.total ?? 0),
            changePercent: stats?.otherDocuments.changePercent,
          },
        ]}
      />

      <FilterBar className="items-center">
        <SearchInput value={search} onValueChange={handleSearchChange} placeholder="Search by title, student" />
        <SelectDropdown
          aria-label="Filter by category"
          placeholder="All categories"
          value={category}
          onValueChange={(value) => {
            setCategory(value);
            setPage(1);
          }}
          options={[
            { value: '', label: 'All categories' },
            ...CATEGORIES.map((c) => ({ value: c.value, label: c.label })),
          ]}
        />
        {(search || category) && (
          <Button
            variant="ghost"
            onClick={() => {
              setSearch('');
              setCategory('');
              setPage(1);
            }}
          >
            Clear filters
          </Button>
        )}
        <PageBranchScopeControl />
      </FilterBar>

      <div className="bg-white">
        <div className={dataTableWrapperClass}>
          <table className={dataTableClass}>
            <thead>
              <tr>
                <th className={dataTableThClass}>Title</th>
                <th className={dataTableThClass}>Student</th>
                <th className={dataTableThClass}>Category</th>
                <th className={dataTableThClass}>Uploaded</th>
                <th className={cn(dataTableThClass, 'w-12')} />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {isLoading && <DataTableSkeletonRows columns={5} rows={limit} />}

              {error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load documents
                  </td>
                </tr>
              )}

              {!isLoading && !error && rows.length === 0 && (
                <EmptyStateCell colSpan={5} title="No documents found" />
              )}

              {!isLoading &&
                !error &&
                rows.map((doc) => (
                  <tr key={doc.id} className={categoryRowClass(doc.category)}>
                    <td className={dataTableTdClass}>{doc.title}</td>
                    <td className={dataTableTdClass}>{doc.student?.fullName ?? '—'}</td>
                    <td className={dataTableTdClass}>{categoryLabel(doc.category)}</td>
                    <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className={cn(dataTableTdClass, 'text-right')}>
                      <RowActionsMenu
                        items={[
                          {
                            label: 'Open',
                            onClick: () => openDocument(doc.id),
                          },
                          ...(canUpload
                            ? [
                                {
                                  label: 'Delete',
                                  onClick: () => setDeleteTarget(doc),
                                },
                              ]
                            : []),
                        ]}
                      />
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {documents?.meta && (
          <PaginationBar
            page={page}
            totalPages={documents.meta.totalPages}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={handleLimitChange}
          />
        )}
      </div>
    </div>
  );
}
