import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./reports-client'));

export default function Page() {
  return <PageClient />;
}
