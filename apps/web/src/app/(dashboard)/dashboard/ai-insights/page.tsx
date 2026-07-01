import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./ai-insights-client'));

export default function Page() {
  return <PageClient />;
}
