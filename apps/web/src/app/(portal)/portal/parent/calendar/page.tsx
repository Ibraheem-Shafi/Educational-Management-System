'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { PortalCalendarSection } from '@/components/portal/portal-calendar-section';
import { PortalParentPageShell } from '@/components/portal/portal-parent-page-shell';

export default function ParentCalendarPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={CalendarDays} title="Calendar" description="School events and due dates" />
      <PortalParentPageShell>
        {({ childId }) => (
          <PortalCalendarSection
            basePath="/portal/parent/calendar"
            queryKey={queryKeys.portalParentCalendar}
            month={month}
            onMonthChange={setMonth}
            studentId={childId}
          />
        )}
      </PortalParentPageShell>
    </div>
  );
}
