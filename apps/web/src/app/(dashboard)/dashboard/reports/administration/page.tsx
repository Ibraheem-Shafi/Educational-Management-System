import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./administration-client'));

export default function Page() {
  return <PageClient />;
}
