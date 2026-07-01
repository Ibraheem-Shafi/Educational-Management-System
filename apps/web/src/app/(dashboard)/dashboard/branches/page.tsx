import { PageHeader } from '@/components/layout/page-header';
import { BranchesClient } from './branches-client';

export default function BranchesPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Branches" description="Manage institution branches" />
      <BranchesClient />
    </div>
  );
}
