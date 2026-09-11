'use client';

import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { SidebarExpandedProvider } from './sidebar-context';
import { PortalSidebarNav } from './portal-sidebar-nav';

export function PortalMobileNavSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[min(100vw,272px)] border-transparent bg-sidebar-bg p-0">
        <SheetTitle className="sr-only">Portal navigation menu</SheetTitle>
        <SidebarExpandedProvider>
          <PortalSidebarNav onNavigate={() => onOpenChange(false)} />
        </SidebarExpandedProvider>
      </SheetContent>
    </Sheet>
  );
}
