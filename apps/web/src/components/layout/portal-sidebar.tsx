'use client';

import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';

const PortalSidebarNav = dynamic(
  () => import('./portal-sidebar-nav').then((m) => ({ default: m.PortalSidebarNav })),
  {
    loading: () => (
      <div
        className={cn(
          'hidden h-screen shrink-0 animate-pulse border-r border-stroke-soft-200 bg-neutral-0 lg:block',
          'w-[clamp(220px,19vw,272px)]',
        )}
      />
    ),
  },
);

export function PortalSidebar() {
  const { collapsed } = useSidebar();

  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-screen shrink-0 flex-col border-r border-stroke-soft-200 bg-neutral-0 font-[family-name:var(--font-inter)] transition-[width] duration-200 lg:flex',
        collapsed ? 'w-[clamp(56px,4.5vw,72px)]' : 'w-[clamp(220px,19vw,272px)]',
      )}
    >
      <PortalSidebarNav />
    </aside>
  );
}
