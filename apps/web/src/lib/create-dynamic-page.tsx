import dynamic from 'next/dynamic';
import type { ComponentType } from 'react';
import { PageContentSkeleton } from '@/components/layout/page-content-skeleton';

type ClientModule = { default: ComponentType };

export function createDynamicPage(importFn: () => Promise<ClientModule>) {
  return dynamic(importFn, {
    loading: () => <PageContentSkeleton />,
  });
}
