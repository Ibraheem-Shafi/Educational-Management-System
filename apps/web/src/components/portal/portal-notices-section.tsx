'use client';

import { ContentPanel } from '@/components/layout/content-panel';
import { PaginationBar } from '@/components/layout/pagination-bar';
import { StatusBadge } from '@/components/layout/status-badge';

interface Notice {
  id?: string;
  title: string;
  body: string;
  audience?: string;
  publishedAt?: string | null;
}

export function PortalNoticesSection({
  notices,
  page,
  totalPages,
  onPageChange,
  limit,
  onLimitChange,
}: {
  notices: Notice[];
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  limit?: number;
  onLimitChange?: (limit: number) => void;
}) {
  return (
    <ContentPanel title={`Announcements (${notices.length} on this page)`}>
      {notices.length === 0 ? (
        <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No announcements yet</p>
      ) : (
        <>
          <ul className="divide-y divide-stroke-soft-200">
            {notices.map((n) => (
              <li key={n.id ?? n.title} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-text-main-900">{n.title}</p>
                  {n.audience && <StatusBadge label={n.audience} code={n.audience} />}
                </div>
                <p className="mt-1 text-sm text-[var(--text-sub-500)]">{n.body}</p>
                {n.publishedAt && (
                  <p className="mt-2 text-xs text-text-soft-400">
                    {new Date(n.publishedAt).toLocaleDateString()}
                  </p>
                )}
              </li>
            ))}
          </ul>
          {page && totalPages && totalPages > 1 && onPageChange && (
            <div className="border-t border-stroke-soft-200 px-5 py-3">
              <PaginationBar
                page={page}
                totalPages={totalPages}
                onPageChange={onPageChange}
                limit={limit ?? 20}
                onLimitChange={onLimitChange ?? (() => {})}
              />
            </div>
          )}
        </>
      )}
    </ContentPanel>
  );
}
