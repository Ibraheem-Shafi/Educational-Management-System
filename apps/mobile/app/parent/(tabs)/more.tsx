import { MoreMenu } from '@/screens/portal';

export default function Page() {
  return (
    <MoreMenu
      items={[
        { label: 'Attendance', href: '/parent/attendance' },
        { label: 'Assessments', href: '/parent/assessments' },
        { label: 'Timetable', href: '/parent/timetable' },
        { label: 'Notices', href: '/parent/notices' },
        { label: 'Documents', href: '/parent/documents' },
        { label: 'Calendar', href: '/parent/calendar' },
        { label: 'Leave requests', href: '/parent/leave' },
        { label: 'Profile', href: '/parent/profile' },
      ]}
    />
  );
}
