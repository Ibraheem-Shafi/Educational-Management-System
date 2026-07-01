import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./timetable-client'));

export default function Page() {
  return <PageClient />;
}
