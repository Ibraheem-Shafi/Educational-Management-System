import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./finance-ops-client'));

export default function Page() {
  return <PageClient />;
}
