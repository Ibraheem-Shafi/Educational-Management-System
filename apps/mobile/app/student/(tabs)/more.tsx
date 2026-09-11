import { MoreMenu } from '@/screens/portal';

export default function Page() {
  return (
    <MoreMenu
      items={[
        { label: 'Assessments', href: '/student/assessments' },
        { label: 'Timetable', href: '/student/timetable' },
        { label: 'Notices', href: '/student/notices' },
        { label: 'Documents', href: '/student/documents' },
        { label: 'Calendar', href: '/student/calendar' },
        { label: 'Insights', href: '/student/insights' },
        { label: 'Profile', href: '/student/profile' },
      ]}
    />
  );
}
