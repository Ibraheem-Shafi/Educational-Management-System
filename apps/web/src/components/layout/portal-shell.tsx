'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  BookOpen,
  ClipboardCheck,
  Wallet,
  Bell,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useInstitution } from '@/providers/institution-provider';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { SidebarProvider } from './sidebar-context';
import { PortalSidebar } from './portal-sidebar';
import { PortalHeader } from './portal-header';

interface BottomNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match: (pathname: string) => boolean;
  roles?: Array<'student' | 'parent'>;
}

const studentBottomNav: BottomNavItem[] = [
  {
    href: '/portal/student',
    label: 'Home',
    icon: Home,
    match: (p) => p === '/portal/student' || p === '/portal/student/',
    roles: ['student'],
  },
  {
    href: '/portal/student/learning',
    label: 'Learning',
    icon: BookOpen,
    match: (p) => p.includes('/portal/student/learning'),
    roles: ['student'],
  },
  {
    href: '/portal/student/attendance',
    label: 'Attendance',
    icon: ClipboardCheck,
    match: (p) => p.includes('/portal/student/attendance'),
    roles: ['student'],
  },
  {
    href: '/portal/student/fees',
    label: 'Fees',
    icon: Wallet,
    match: (p) => p.includes('/portal/student/fees'),
    roles: ['student'],
  },
  {
    href: '/portal/student/notices',
    label: 'Notices',
    icon: Bell,
    match: (p) => p.includes('/portal/student/notices'),
    roles: ['student'],
  },
];

const parentBottomNav: BottomNavItem[] = [
  {
    href: '/portal/parent',
    label: 'Home',
    icon: Home,
    match: (p) => p === '/portal/parent' || p === '/portal/parent/',
    roles: ['parent'],
  },
  {
    href: '/portal/parent/learning',
    label: 'Learning',
    icon: BookOpen,
    match: (p) => p.includes('/portal/parent/learning'),
    roles: ['parent'],
  },
  {
    href: '/portal/parent/children',
    label: 'Children',
    icon: Users,
    match: (p) => p.includes('/portal/parent/children'),
    roles: ['parent'],
  },
  {
    href: '/portal/parent/fees',
    label: 'Fees',
    icon: Wallet,
    match: (p) => p.includes('/portal/parent/fees'),
    roles: ['parent'],
  },
  {
    href: '/portal/parent/notices',
    label: 'Notices',
    icon: Bell,
    match: (p) => p.includes('/portal/parent/notices'),
    roles: ['parent'],
  },
];

function PortalBottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const roles = user?.roles ?? [];

  const items = [
    ...(roles.includes('student') ? studentBottomNav : []),
    ...(roles.includes('parent') ? parentBottomNav : []),
  ];

  if (items.length === 0) {
    return (
      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
        <div className="mx-auto flex max-w-4xl justify-around py-2">
          <Link
            href="/portal"
            className="flex flex-col items-center gap-1 px-3 py-1 text-xs text-[var(--institution-primary)]"
          >
            <BookOpen className="h-5 w-5" />
            Portal
          </Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background lg:hidden">
      <div className="mx-auto flex max-w-4xl justify-around py-2">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={`${item.href}-${item.label}`}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-1 px-3 py-1 text-xs font-[family-name:var(--font-inter)]',
                active ? 'text-[var(--institution-primary)]' : 'text-muted-foreground',
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function PortalDashboardShell({ children }: { children: ReactNode }) {
  const { settings } = useInstitution();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!settings) return;
    const flags = settings.featureFlags;
    if (pathname.includes('/portal/parent') && flags?.parentPortal === false) {
      router.replace('/login?error=parent_portal_disabled');
    }
    if (pathname.includes('/portal/student') && flags?.studentPortal === false) {
      router.replace('/login?error=student_portal_disabled');
    }
  }, [settings, pathname, router]);

  return (
    <SidebarProvider>
      <div className="flex h-screen min-w-0 overflow-hidden">
        <PortalSidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <PortalHeader />
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-24 font-[family-name:var(--font-inter)] lg:p-6 lg:pb-6">
            {children}
          </main>
        </div>
      </div>
      <PortalBottomNav />
    </SidebarProvider>
  );
}

/** @deprecated Use PortalDashboardShell */
export const PortalShell = PortalDashboardShell;
