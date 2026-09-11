'use client';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { SidebarExpandedProvider } from './sidebar-context';
import { SidebarNav } from './sidebar-nav';

export function MobileNavSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[min(100vw,272px)] border-transparent bg-sidebar-bg p-0">
        <SheetTitle className="sr-only">Navigation menu</SheetTitle>
        <SidebarExpandedProvider>
          <SidebarNav onNavigate={() => onOpenChange(false)} />
        </SidebarExpandedProvider>
      </SheetContent>
    </Sheet>
  );
}
