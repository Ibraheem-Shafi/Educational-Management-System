'use client';

import dynamic from 'next/dynamic';

const SidebarNav = dynamic(
  () => import('./sidebar-nav').then((m) => ({ default: m.SidebarNav })),
  {
    loading: () => (
      <div className="hidden h-screen w-64 shrink-0 animate-pulse border-r border-border bg-muted/30 lg:block" />
    ),
  },
);

export { navItems } from './sidebar-nav';

export function Sidebar() {
  return (
    <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-muted/30 lg:flex">
      <SidebarNav />
    </aside>
  );
}
