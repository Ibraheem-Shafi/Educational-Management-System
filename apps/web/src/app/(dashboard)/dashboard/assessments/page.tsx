import { createDynamicPage } from '@/lib/create-dynamic-page';

const PageClient = createDynamicPage(() => import('./assessments-client'));

export default function Page() {
  return <PageClient />;
}
