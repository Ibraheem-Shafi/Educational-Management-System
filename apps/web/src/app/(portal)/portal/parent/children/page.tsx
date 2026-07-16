'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  ClipboardCheck,
  FileText,
  Wallet,
  Calendar,
  BookOpen,
  Users,
} from 'lucide-react';
import { formatCurrency } from '@eims/shared';
import { useAuth } from '@/providers/auth-provider';
import { apiClient } from '@/lib/api-client';
import {
  PORTAL_PARENT_KEY,
  attendanceRatePercents,
  type ParentPortalData,
} from '@/lib/portal-types';
import { PageHeader } from '@/components/layout/page-header';
import { ContentPanel } from '@/components/layout/content-panel';
import { PortalPageSkeleton } from '@/components/layout/portal-page-skeleton';
import { UserAvatar } from '@/components/layout/user-avatar';

const SECTION_LINKS = [
  { href: '/portal/parent/attendance', label: 'Attendance', icon: ClipboardCheck },
  { href: '/portal/parent/assessments', label: 'Assessments', icon: FileText },
  { href: '/portal/parent/fees', label: 'Fees', icon: Wallet },
  { href: '/portal/parent/timetable', label: 'Timetable', icon: Calendar },
  { href: '/portal/parent/learning', label: 'Learning', icon: BookOpen },
] as const;

export default function ParentChildrenPage() {
  const { session } = useAuth();
  const token = session?.access_token;

  const { data, isLoading, error } = useQuery({
    queryKey: PORTAL_PARENT_KEY,
    queryFn: () => apiClient<ParentPortalData>('/portal/parent', { token }),
    enabled: !!token,
  });

  if (isLoading && !data) return <PortalPageSkeleton />;
  if (error) return <p className="text-red-600">Unable to load children.</p>;

  const children = data?.children ?? [];

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader
        icon={Users}
        title="My children"
        description="Overview and quick links for each child"
      />

      {children.length === 0 ? (
        <ContentPanel>
          <p className="px-5 py-6 text-sm text-[var(--text-sub-500)]">No linked children</p>
        </ContentPanel>
      ) : (
        <div className="space-y-4">
          {children.map((child) => {
            const childRates = attendanceRatePercents(child.attendance);
            const childId = child.student.id;
            const childParam = `childId=${encodeURIComponent(childId)}`;

            return (
              <ContentPanel key={childId} title={child.student.fullName}>
                <div className="px-5 py-4">
                  <div className="flex items-start gap-4">
                    <UserAvatar name={child.student.fullName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-[var(--text-sub-500)]">
                        Relationship: {child.relationshipCode}
                      </p>
                      <p className="mt-1 text-sm text-text-main-900">
                        Attendance {childRates.present}% · Outstanding{' '}
                        {formatCurrency(child.fees.outstanding)}
                      </p>
                      <Link
                        href={`/portal/parent/children/${childId}`}
                        className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-[var(--institution-primary)] hover:underline"
                      >
                        Full overview
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {SECTION_LINKS.map((section) => {
                      const Icon = section.icon;
                      return (
                        <Link
                          key={section.href}
                          href={`${section.href}?${childParam}`}
                          className="flex items-center gap-2 rounded-lg border border-stroke-soft-200 px-3 py-2 text-sm font-medium text-text-main-900 transition-colors hover:bg-neutral-50"
                        >
                          <Icon className="h-4 w-4 shrink-0 text-icon-primary" strokeWidth={1.5} />
                          {section.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </ContentPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
