import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./hr-client'));

export default function Page() {
  return <PageClient />;
}
