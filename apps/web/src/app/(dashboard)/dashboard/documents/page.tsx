'use client';

import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { apiClient } from '@/lib/api-client';
import { useEffectiveBranchId } from '@/hooks/use-branches';
import type { DocumentsStatsResponse } from '@eims/types';
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
import { RowActionsMenu } from '@/components/layout/row-actions-menu';
import { UploadDocumentDialog } from '@/components/features/documents/upload-document-dialog';
import {
  dataTableClass,
  dataTableRowHoverClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
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
  student?: { fullName: string };
}

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export default function DocumentsPage() {
  const { session, user } = useAuth();
  const { can } = usePermissions();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const canUpload = can(PERMISSIONS.DOCUMENTS_UPLOAD);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const { effectiveBranchId } = useEffectiveBranchId(token, user?.branchId);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: queryKeys.documentsStats,
    queryFn: () => apiClient<DocumentsStatsResponse>('/documents/stats', { token }),
    enabled: !!token,
  });

  const { data: documents, isLoading, error } = useQuery({
    queryKey: ['documents', effectiveBranchId],
    queryFn: () =>
      apiClient<{ data: DocumentRow[] }>(`/documents?branchId=${effectiveBranchId}`, { token }),
    enabled: !!token && !!effectiveBranchId,
  });

  const filteredDocuments = useMemo(() => {
    const list = documents?.data ?? [];
    return list.filter((doc) => {
      if (search) {
        const q = search.toLowerCase();
        if (
          !doc.title.toLowerCase().includes(q) &&
          !(doc.student?.fullName ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      if (category && doc.category !== category) return false;
      return true;
    });
  }, [documents?.data, search, category]);

  const openDocument = async (id: string) => {
    try {
      const res = await apiClient<{ url: string }>(`/documents/${id}/signed-url`, { token });
      window.open(res.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to open document');
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient(`/documents/${id}`, { method: 'DELETE', token }),
    onSuccess: () => {
      toast.success('Document deleted');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.documentsStats });
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
          branchId={effectiveBranchId}
        />
      )}

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
        <SearchInput value={search} onValueChange={handleSearchChange} />
        <SelectDropdown
          aria-label="Filter by category"
          placeholder="All categories"
          value={category}
          onValueChange={setCategory}
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
            }}
          >
            Clear filters
          </Button>
        )}
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
              {isLoading && <DataTableSkeletonRows columns={5} rows={8} />}

              {error && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-red-600">
                    Failed to load documents
                  </td>
                </tr>
              )}

              {!isLoading && !error && filteredDocuments.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-10 text-center text-sm text-[var(--base-muted-foreground,#71717A)]"
                  >
                    No documents found
                  </td>
                </tr>
              )}

              {!isLoading &&
                !error &&
                filteredDocuments.map((doc) => (
                  <tr key={doc.id} className={cn('transition-colors', dataTableRowHoverClass)}>
                    <td className={dataTableTdClass}>{doc.title}</td>
                    <td className={dataTableTdClass}>{doc.student?.fullName ?? '—'}</td>
                    <td className={dataTableTdClass}>{categoryLabel(doc.category)}</td>
                    <td className={cn(dataTableTdClass, 'whitespace-nowrap')}>
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </td>
                    <td className={cn(dataTableTdClass, 'text-right')}>
                      <RowActionsMenu
                        items={[
                          { label: 'Open', onClick: () => openDocument(doc.id) },
                          ...(canUpload
                            ? [
                                {
                                  label: 'Delete',
                                  onClick: () => {
                                    if (confirm('Delete this document?')) {
                                      deleteMutation.mutate(doc.id);
                                    }
                                  },
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
      </div>
    </div>
  );
}
