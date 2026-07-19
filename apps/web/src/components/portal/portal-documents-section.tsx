'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, FileStack } from 'lucide-react';
import { toast } from 'sonner';
import type { PaginatedResponse, PortalDocumentItem } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { buildPortalQuery } from '@/lib/portal-api';
import { ContentPanel } from '@/components/layout/content-panel';
import { PaginationBar } from '@/components/layout/pagination-bar';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
  dataTableWrapperClass,
} from '@/components/layout/data-table-styles';
import { cn } from '@/lib/utils';

export function PortalDocumentsSection({
  basePath,
  queryKey,
  studentId,
}: {
  basePath: string;
  queryKey: (params: Record<string, unknown>) => readonly unknown[];
  studentId?: string;
}) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(8);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const params = { page, limit, studentId };
  const { data, isLoading } = useQuery({
    queryKey: queryKey(params),
    queryFn: () =>
      apiClient<PaginatedResponse<PortalDocumentItem>>(
        `${basePath}${buildPortalQuery({ page, limit, studentId })}`,
        { token },
      ),
    enabled: !!token && (studentId ? !!studentId : true),
  });

  const download = useMutation({
    mutationFn: async (docId: string) => {
      const signedPath = studentId
        ? `${basePath}/${docId}/signed-url?studentId=${encodeURIComponent(studentId)}`
        : `${basePath}/${docId}/signed-url`;
      return apiClient<{ url: string }>(signedPath, { token });
    },
    onSuccess: (result) => {
      window.open(result.url, '_blank', 'noopener,noreferrer');
    },
    onError: () => toast.error('Unable to download document'),
    onSettled: () => setDownloadingId(null),
  });

  const items = data?.data ?? [];

  return (
    <ContentPanel title={`Documents (${data?.meta.total ?? items.length})`}>
      {isLoading && !data ? (
        <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">Loading…</p>
      ) : (
        <>
          <div className={dataTableWrapperClass}>
            <table className={cn(dataTableClass, 'min-w-[560px]')}>
              <thead>
                <tr>
                  <th className={dataTableThClass}>Title</th>
                  <th className={dataTableThClass}>Category</th>
                  <th className={dataTableThClass}>Date</th>
                  <th className={dataTableThClass}>
                    <span className="sr-only">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-sm text-[var(--text-sub-500)]">
                      No documents available
                    </td>
                  </tr>
                ) : (
                  items.map((doc) => (
                    <tr key={doc.id}>
                      <td className={dataTableTdClass}>
                        <div className="flex items-center gap-2">
                          <FileStack className="h-4 w-4 text-icon-primary" />
                          {doc.title}
                        </div>
                      </td>
                      <td className={dataTableTdClass}>{doc.category}</td>
                      <td className={dataTableTdClass}>
                        {new Date(doc.createdAt).toLocaleDateString()}
                      </td>
                      <td className={dataTableTdClass}>
                        <button
                          type="button"
                          disabled={downloadingId === doc.id}
                          onClick={() => {
                            setDownloadingId(doc.id);
                            download.mutate(doc.id);
                          }}
                          className="inline-flex items-center gap-1 text-sm text-[var(--institution-primary)] hover:underline disabled:opacity-50"
                        >
                          <Download className="h-4 w-4" />
                          Download
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {data?.meta && (
            <div className="border-t border-stroke-soft-200 px-5 py-3">
              <PaginationBar
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onPageChange={setPage}
                limit={limit}
                onLimitChange={(next) => {
                  setLimit(next);
                  setPage(1);
                  void queryClient.invalidateQueries({ queryKey: queryKey({ page: 1, limit: next, studentId }) });
                }}
              />
            </div>
          )}
        </>
      )}
    </ContentPanel>
  );
}
