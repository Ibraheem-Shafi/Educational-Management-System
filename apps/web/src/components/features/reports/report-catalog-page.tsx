'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, FileBarChart } from 'lucide-react';
import { toast } from 'sonner';
import { PERMISSIONS } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { usePermissions } from '@/hooks/use-permissions';
import { useEffectiveBranchScope } from '@/hooks/use-page-branch-scope';
import { PageBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { StatusBadge } from '@/components/layout/status-badge';
import { ComingSoonBanner } from '@/components/coming-soon/coming-soon-banner';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import {
  dataTableClass,
  dataTableTdClass,
  dataTableThClass,
} from '@/components/layout/data-table-styles';
import { getRequiredPermissionForPath } from '@/lib/permissions';
import {
  REPORT_GROUP_META,
  catalogCounts,
  reportsForGroup,
  type ReportCatalogItem,
  type ReportGroup,
} from '@/lib/report-catalog';
import {
  generateCatalogReport,
  generateCatalogReportErrorMessage,
} from '@/lib/generate-catalog-report';

function canOpenHref(item: ReportCatalogItem, can: (permission: string) => boolean): boolean {
  if (!item.href) return false;
  const required = getRequiredPermissionForPath(item.href);
  if (required === undefined) return false;
  if (required === null) return true;
  return can(required);
}

function canGenerateItem(
  item: ReportCatalogItem,
  canAny: (permissions: string[]) => boolean,
): boolean {
  if (item.status !== 'ready' || !item.generateKey) return false;
  if (item.sourcePermissions.length === 0) return true;
  return canAny(item.sourcePermissions);
}

export function ReportCatalogPage({ group }: { group: ReportGroup }) {
  const meta = REPORT_GROUP_META[group];
  const items = reportsForGroup(group);
  const counts = catalogCounts(group);
  const { session } = useAuth();
  const { can, canAny } = usePermissions();
  const token = session?.access_token;
  const canViewReports = can(PERMISSIONS.REPORTS_VIEW);
  const { effectiveScope, singleBranchId } = useEffectiveBranchScope();
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const hasComingSoon = counts.comingSoon > 0;

  const handleGenerate = async (item: ReportCatalogItem) => {
    if (!item.generateKey || !token) return;
    setGeneratingId(item.id);
    try {
      await generateCatalogReport(item.generateKey, {
        token,
        scope: effectiveScope,
        singleBranchId,
      });
    } catch (error) {
      toast.error(generateCatalogReportErrorMessage(error));
    } finally {
      setGeneratingId(null);
    }
  };

  if (!canViewReports) {
    return (
      <div className="space-y-6 font-[family-name:var(--font-inter)]">
        <PageHeader icon={FileBarChart} title={meta.title} description={meta.description} />
        <p className="text-sm text-[var(--text-sub-500)]">You do not have permission to view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={FileBarChart} title={meta.title} description={meta.description} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button size="sm" variant="outline" asChild>
          <Link href="/dashboard/reports">All catalogs</Link>
        </Button>
        <PageBranchScopeControl />
      </div>

      {hasComingSoon ? <ComingSoonBanner featureId="catalog-reports" /> : null}

      <ContentPanel title={`${counts.ready} ready / ${counts.comingSoon} coming soon`}>
        <div className="overflow-x-auto">
          <table className={dataTableClass} style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th className={dataTableThClass}>#</th>
                <th className={dataTableThClass}>Report</th>
                <th className={dataTableThClass}>Status</th>
                <th className={dataTableThClass}>Actions</th>
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {items.map((item) => {
                const comingSoon = item.status === 'coming_soon';
                const showGenerate = canGenerateItem(item, canAny);
                const showOpen = canOpenHref(item, can);
                const generating = generatingId === item.id;

                return (
                  <tr key={item.id}>
                    <td className={dataTableTdClass}>{item.number}</td>
                    <td className={dataTableTdClass}>{item.title}</td>
                    <td className={dataTableTdClass}>
                      {comingSoon ? (
                        <StatusBadge label="Coming soon" code="draft" />
                      ) : (
                        <StatusBadge label="Ready" code="active" />
                      )}
                    </td>
                    <td className={dataTableTdClass}>
                      <div className="flex flex-wrap items-center gap-2">
                        {comingSoon ? (
                          <Tooltip content="This report has no data model yet. Generate is disabled.">
                            <span>
                              <Button size="sm" variant="outline" disabled>
                                <Download className="mr-2 h-4 w-4" />
                                Generate
                              </Button>
                            </span>
                          </Tooltip>
                        ) : showGenerate ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={generating || generatingId !== null}
                            onClick={() => void handleGenerate(item)}
                          >
                            <Download className="mr-2 h-4 w-4" />
                            {generating ? 'Generating…' : 'Generate'}
                          </Button>
                        ) : item.generateKey ? (
                          <Tooltip content="You do not have permission to generate this report.">
                            <span>
                              <Button size="sm" variant="outline" disabled>
                                <Download className="mr-2 h-4 w-4" />
                                Generate
                              </Button>
                            </span>
                          </Tooltip>
                        ) : null}
                        {showOpen ? (
                          <Button size="sm" variant="ghost" asChild>
                            <Link href={item.href!}>
                              <ExternalLink className="mr-2 h-4 w-4" />
                              Open existing
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ContentPanel>
    </div>
  );
}
