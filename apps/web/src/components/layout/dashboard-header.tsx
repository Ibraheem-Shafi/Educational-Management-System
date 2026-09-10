'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import { useState } from 'react';
import { Menu } from 'lucide-react';
import { useInstitution } from '@/providers/institution-provider';
import { Button } from '@/components/ui/button';
import { AppBranchScopeControl } from '@/components/layout/branch-scope-controls';
import { useAppBranchScopeOptional } from '@/providers/branch-scope-provider';

const MobileNavSheet = dynamic(
  () => import('./mobile-nav-sheet').then((m) => ({ default: m.MobileNavSheet })),
  { ssr: false },
);

function HeaderBrand() {
  const { name, logoUrl } = useInstitution();
  const hasInstitutionLogo = logoUrl && !logoUrl.startsWith('storage://');

  if (hasInstitutionLogo) {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <Image
          src={logoUrl}
          alt={name}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded object-contain"
        />
        <span className="min-w-0 truncate font-semibold">{name}</span>
      </div>
    );
  }

  // Fallback wordmark already contains the brand name.
  return (
    <div className="flex min-w-0 items-center">
      <Image
        src="/logo.png"
        alt={name}
        width={180}
        height={40}
        className="h-8 w-auto max-w-full object-contain"
        priority
      />
    </div>
  );
}

export function DashboardHeader() {
  const [open, setOpen] = useState(false);
  const branchScope = useAppBranchScopeOptional();
  const showBranchControl = !!branchScope?.canSelect || !!branchScope?.isLocked;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background">
      <div className="flex items-center gap-3 px-4 py-3">
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 px-2 lg:hidden"
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Open menu</span>
        </Button>
        <div className="flex min-w-0 flex-1 justify-center lg:hidden">
          <HeaderBrand />
        </div>
        {/* Invisible spacer mirroring the menu button so the brand is truly centered. */}
        <div className="w-9 shrink-0 lg:hidden" aria-hidden />
        <div className="hidden min-w-0 flex-1 lg:block" />
        {showBranchControl ? (
          <AppBranchScopeControl className="hidden max-w-[280px] shrink-0 lg:block" size="sm" />
        ) : null}
      </div>
      {showBranchControl ? (
        <div className="border-t border-border px-4 py-2 lg:hidden">
          <AppBranchScopeControl className="w-full max-w-none" size="sm" />
        </div>
      ) : null}
      <MobileNavSheet open={open} onOpenChange={setOpen} />
    </header>
  );
}
