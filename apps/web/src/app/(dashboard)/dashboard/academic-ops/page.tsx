import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./academic-ops-client'));

export default function Page() {
  return <PageClient />;
}
