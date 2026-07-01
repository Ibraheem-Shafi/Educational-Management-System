'use client';

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { useInstitution } from '@/providers/institution-provider';
import { Button } from '@/components/ui/button';

const MobileNavSheet = dynamic(
  () => import('./mobile-nav-sheet').then((m) => ({ default: m.MobileNavSheet })),
  { ssr: false },
);

export function DashboardHeader() {
  const { name } = useInstitution();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-background px-4 py-3 lg:hidden">
      <Button variant="ghost" size="sm" className="shrink-0 px-2" onClick={() => setOpen(true)}>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Open menu</span>
      </Button>
      <span className="truncate font-semibold">{name}</span>
      <MobileNavSheet open={open} onOpenChange={setOpen} />
    </header>
  );
}
