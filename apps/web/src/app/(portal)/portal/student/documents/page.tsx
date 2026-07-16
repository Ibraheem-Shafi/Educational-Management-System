'use client';

import { FileStack } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { PortalDocumentsSection } from '@/components/portal/portal-documents-section';

export default function StudentDocumentsPage() {
  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={FileStack} title="Documents" description="Certificates, receipts, and shared files" />
      <PortalDocumentsSection
        basePath="/portal/student/documents"
        queryKey={queryKeys.portalStudentDocuments}
      />
    </div>
  );
}
