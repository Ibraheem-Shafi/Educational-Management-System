'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, BookOpen, Download, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import type { LearningResourceResponse } from '@eims/types';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import { queryKeys } from '@/lib/query-keys';
import { formatLearningDueAt, learningTypeLabel } from '@/lib/portal-learning';
import { OnlineClassSessionMeta } from '@/components/features/learning/online-class-session';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';

export default function ParentLearningDetailPage() {
  return (
    <Suspense fallback={<PortalPageSkeleton />}>
      <ParentLearningDetailContent />
    </Suspense>
  );
}

function ParentLearningDetailContent() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const studentId =
    searchParams.get('childId') ?? searchParams.get('studentId') ?? '';
  const { session } = useAuth();
  const token = session?.access_token;
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const backHref = studentId
    ? `/portal/parent/learning?childId=${encodeURIComponent(studentId)}`
    : '/portal/parent/learning';

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.portalParentLearningDetail(id, studentId),
    queryFn: () =>
      apiClient<LearningResourceResponse>(
        `/portal/parent/learning/${id}?studentId=${encodeURIComponent(studentId)}`,
        { token },
      ),
    enabled: !!token && !!id && !!studentId,
  });

  const handleDownload = async (attachmentId: string, fileName: string) => {
    if (!token || !studentId) return;
    setDownloadingId(attachmentId);
    try {
      const res = await apiClient<{ url: string }>(
        `/portal/parent/learning/${id}/attachments/${attachmentId}/signed-url?studentId=${encodeURIComponent(studentId)}`,
        { token },
      );
      const anchor = document.createElement('a');
      anchor.href = res.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch {
      toast.error('Unable to download attachment');
    } finally {
      setDownloadingId(null);
    }
  };

  if (!studentId) {
    return (
      <div className="space-y-4 font-[family-name:var(--font-inter)]">
        <Link
          href="/portal/parent/learning"
          className="inline-flex items-center gap-2 text-sm text-[var(--text-sub-500)] hover:text-text-main-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to learning
        </Link>
        <p className="text-sm text-[var(--text-sub-500)]">Select a child to view this resource.</p>
      </div>
    );
  }

  if (isLoading) return <PortalPageSkeleton />;
  if (error || !data) {
    return (
      <div className="space-y-4 font-[family-name:var(--font-inter)]">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-sub-500)] hover:text-text-main-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to learning
        </Link>
        <p className="text-red-600">Unable to load this resource.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <div className="space-y-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 text-sm text-[var(--text-sub-500)] hover:text-text-main-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to learning
        </Link>
        <PageHeader
          icon={BookOpen}
          title={data.title}
          description={data.description ?? learningTypeLabel(data.type)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge label={learningTypeLabel(data.type)} code={data.type} />
        {data.subject?.name && (
          <span className="text-sm text-[var(--text-sub-500)]">{data.subject.name}</span>
        )}
        {data.dueAt && (
          <span className="text-sm text-[var(--text-sub-500)]">
            Due {formatLearningDueAt(data.dueAt)}
          </span>
        )}
        {data.maxMarks != null && (
          <span className="text-sm text-[var(--text-sub-500)]">Max marks: {data.maxMarks}</span>
        )}
      </div>

      {data.type === 'online_class' && (
        <OnlineClassSessionMeta
          startsAt={data.startsAt}
          endsAt={data.endsAt}
          meetingUrl={data.meetingUrl}
        />
      )}

      <ContentPanel title="Details">
        <div className="space-y-4 px-5 py-4">
          {data.body ? (
            <div className="whitespace-pre-wrap text-sm leading-6 text-text-main-900">{data.body}</div>
          ) : (
            <p className="text-sm text-[var(--text-sub-500)]">No content body provided.</p>
          )}
        </div>
      </ContentPanel>

      <ContentPanel title={`Attachments (${data.attachments.length})`}>
        {data.attachments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No attachments</p>
        ) : (
          <ul className="divide-y divide-stroke-soft-200">
            {data.attachments.map((att) => (
              <li key={att.id} className="flex items-center gap-3 px-5 py-4">
                <Paperclip className="h-4 w-4 shrink-0 text-icon-primary" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text-main-900">{att.fileName}</p>
                  {att.sizeBytes != null && (
                    <p className="text-xs text-[var(--text-sub-500)]">
                      {(att.sizeBytes / 1024).toFixed(1)} KB
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDownload(att.id, att.fileName)}
                  disabled={downloadingId === att.id}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stroke-soft-200 px-3 py-1.5 text-sm font-medium text-text-main-900 transition-colors hover:bg-neutral-50 disabled:opacity-50"
                >
                  <Download className="h-4 w-4" />
                  {downloadingId === att.id ? 'Opening…' : 'Download'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </ContentPanel>
    </div>
  );
}
