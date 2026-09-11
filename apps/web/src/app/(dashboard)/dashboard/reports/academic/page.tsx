import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./academic-client'));

export default function Page() {
  return <PageClient />;
}
