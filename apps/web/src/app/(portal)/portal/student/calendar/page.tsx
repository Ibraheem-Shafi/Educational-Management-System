'use client';

import { useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { queryKeys } from '@/lib/query-keys';
import { PageHeader } from '@/components/layout/page-header';
import { PortalCalendarSection } from '@/components/portal/portal-calendar-section';

export default function StudentCalendarPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  return (
    <div className="space-y-6 font-[family-name:var(--font-inter)]">
      <PageHeader icon={CalendarDays} title="Calendar" description="Exams, homework, and school events" />
      <PortalCalendarSection
        basePath="/portal/student/calendar"
        queryKey={(_, m) => queryKeys.portalStudentCalendar(m)}
        month={month}
        onMonthChange={setMonth}
      />
    </div>
  );
}
