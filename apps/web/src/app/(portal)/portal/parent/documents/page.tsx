'use client';

import { FileStack } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { PortalDocumentsSection } from '@/components/portal/portal-documents-section';
import { PortalParentPageShell } from '@/components/portal/portal-parent-page-shell';

export default function ParentDocumentsPage() {
  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={FileStack} title="Documents" description="Shared files for your child" />
      <PortalParentPageShell>
        {({ childId }) => (
          <PortalDocumentsSection
            basePath="/portal/parent/documents"
            queryKey={queryKeys.portalParentDocuments}
            studentId={childId}
          />
        )}
      </PortalParentPageShell>
    </div>
  );
}
