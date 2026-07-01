import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./ai-attendance-client'));

export default function Page() {
  return <PageClient />;
}
