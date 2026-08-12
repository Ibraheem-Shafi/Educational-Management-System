'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  LayoutDashboard,
  ClipboardCheck,
  FileText,
  Wallet,
  Calendar,
  Bell,
  BookOpen,
  Users,
  FileStack,
  CalendarDays,
  Sparkles,
  ClipboardList,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  LogOut,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useInstitution } from '@/providers/institution-provider';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';
import { UserAvatar } from './user-avatar';

export interface PortalNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  roles: Array<'student' | 'parent'>;
  /** When true, only exact path matches (e.g. role home). */
  matchExact?: boolean;
  /** Compact readiness label (e.g. demo / unfinished surfaces). */
  badge?: 'soon';
}

export const portalNavItems: PortalNavItem[] = [
  {
    href: '/portal/student',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['student'],
    matchExact: true,
  },
  {
    href: '/portal/student/attendance',
    label: 'Attendance',
    icon: ClipboardCheck,
    roles: ['student'],
  },
  {
    href: '/portal/student/assessments',
    label: 'Assessments',
    icon: FileText,
    roles: ['student'],
  },
  {
    href: '/portal/student/fees',
    label: 'Fees',
    icon: Wallet,
    roles: ['student'],
  },
  {
    href: '/portal/student/timetable',
    label: 'Timetable',
    icon: Calendar,
    roles: ['student'],
  },
  {
    href: '/portal/student/notices',
    label: 'Notices',
    icon: Bell,
    roles: ['student'],
  },
  {
    href: '/portal/student/learning',
    label: 'Learning',
    icon: BookOpen,
    roles: ['student'],
  },
  {
    href: '/portal/student/documents',
    label: 'Documents',
    icon: FileStack,
    roles: ['student'],
  },
  {
    href: '/portal/student/calendar',
    label: 'Calendar',
    icon: CalendarDays,
    roles: ['student'],
  },
  {
    href: '/portal/student/insights',
    label: 'Insights',
    icon: Sparkles,
    roles: ['student'],
    badge: 'soon',
  },
  {
    href: '/portal/parent',
    label: 'Dashboard',
    icon: LayoutDashboard,
    roles: ['parent'],
    matchExact: true,
  },
  {
    href: '/portal/parent/children',
    label: 'My children',
    icon: Users,
    roles: ['parent'],
  },
  {
    href: '/portal/parent/attendance',
    label: 'Attendance',
    icon: ClipboardCheck,
    roles: ['parent'],
  },
  {
    href: '/portal/parent/assessments',
    label: 'Assessments',
    icon: FileText,
    roles: ['parent'],
  },
  {
    href: '/portal/parent/fees',
    label: 'Fees',
    icon: Wallet,
    roles: ['parent'],
  },
  {
    href: '/portal/parent/timetable',
    label: 'Timetable',
    icon: Calendar,
    roles: ['parent'],
  },
  {
    href: '/portal/parent/notices',
    label: 'Notices',
    icon: Bell,
    roles: ['parent'],
  },
  {
    href: '/portal/parent/learning',
    label: 'Learning',
    icon: BookOpen,
    roles: ['parent'],
  },
  {
    href: '/portal/parent/documents',
    label: 'Documents',
    icon: FileStack,
    roles: ['parent'],
  },
  {
    href: '/portal/parent/calendar',
    label: 'Calendar',
    icon: CalendarDays,
    roles: ['parent'],
  },
  {
    href: '/portal/parent/leave',
    label: 'Leave requests',
    icon: ClipboardList,
    roles: ['parent'],
  },
];

function isNavItemActive(pathname: string, item: PortalNavItem): boolean {
  if (item.matchExact) {
    return pathname === item.href || pathname === `${item.href}/`;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function SidebarSeparator() {
  return (
    <div className="flex justify-center" aria-hidden>
      <div className="h-px w-[80%] bg-stroke-soft-200" />
    </div>
  );
}

function SidebarLogo({ collapsed }: { collapsed: boolean }) {
  const { name, logoUrl } = useInstitution();
  const hasInstitutionLogo = logoUrl && !logoUrl.startsWith('storage://');

  if (collapsed) {
    if (hasInstitutionLogo) {
      return (
        <Image
          src={logoUrl}
          alt={name}
          width={32}
          height={32}
          className="h-8 w-8 shrink-0 rounded object-contain"
        />
      );
    }
    return (
      <Image
        src="/logo.png"
        alt={name}
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 object-contain"
      />
    );
  }

  if (hasInstitutionLogo) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Image
          src={logoUrl}
          alt={name}
          width={40}
          height={40}
          className="h-10 w-10 shrink-0 rounded object-contain"
        />
        <span className="truncate text-base font-medium leading-6 tracking-[-0.006em] text-text-main-900">
          {name}
        </span>
      </div>
    );
  }

  return (
    <div className="min-w-0 flex-1 pr-1">
      <Image
        src="/logo.png"
        alt={name}
        width={220}
        height={48}
        className="h-auto w-full object-contain object-left"
        priority
      />
    </div>
  );
}

function CollapseButton() {
  const { collapsed, toggleCollapsed, forceExpanded } = useSidebar();

  if (forceExpanded) return null;

  return (
    <button
      type="button"
      onClick={toggleCollapsed}
      aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      className="flex shrink-0 items-center justify-center rounded-md p-1.5 text-text-soft-400 transition-colors hover:bg-neutral-50 hover:text-text-sub-500"
    >
      {collapsed ? (
        <PanelLeft className="h-5 w-5" strokeWidth={1.75} />
      ) : (
        <PanelLeftClose className="h-5 w-5" strokeWidth={1.75} />
      )}
    </button>
  );
}

function ProfileFooter({
  onNavigate,
  collapsed,
}: {
  onNavigate?: () => void;
  collapsed: boolean;
}) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    onNavigate?.();
    await signOut();
    // Hard navigate so auth cookies + RSC state fully reset (avoids stuck shell).
    window.location.assign('/login');
  };

  return (
    <div ref={menuRef} className="relative px-3 pb-4 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-neutral-50',
          collapsed && 'justify-center px-0',
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <UserAvatar name={user?.fullName} size="md" />
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-5 tracking-[-0.006em] text-text-main-900">
                {user?.fullName}
              </p>
              <p className="truncate text-xs leading-4 text-text-sub-500">{user?.email}</p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-icon-primary" />
          </>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className={cn(
            'absolute z-50 min-w-[160px] rounded-lg border border-stroke-soft-200 bg-neutral-0 py-1 shadow-md',
            collapsed ? 'bottom-full left-1/2 mb-2 -translate-x-1/2' : 'bottom-full left-3 right-3 mb-1',
          )}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onNavigate?.();
              const isParent = user?.roles?.includes('parent');
              router.push(isParent ? '/portal/parent/profile' : '/portal/student/profile');
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-main-900 hover:bg-neutral-50"
          >
            Profile
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-main-900 hover:bg-neutral-50"
          >
            <LogOut className="h-4 w-4 text-icon-primary" />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function PortalSidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { collapsed: contextCollapsed, forceExpanded } = useSidebar();
  const collapsed = forceExpanded ? false : contextCollapsed;

  const roles = user?.roles ?? [];
  const visibleItems = portalNavItems.filter((item) =>
    item.roles.some((role) => roles.includes(role)),
  );

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          'flex py-4',
          collapsed
            ? 'flex-col items-center gap-2 px-2'
            : 'items-center justify-between gap-2 px-5',
        )}
      >
        <SidebarLogo collapsed={collapsed} />
        <CollapseButton />
      </div>

      <SidebarSeparator />

      <nav className="flex-1 overflow-y-auto px-5 py-4">
        {!collapsed && (
          <p className="mb-2 px-3 text-xs font-medium uppercase leading-4 tracking-[0.04em] text-text-soft-400">
            Portal
          </p>
        )}
        <div className="space-y-0.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(pathname, item);
            return (
              <Link
                key={`${item.href}-${item.label}`}
                href={item.href}
                onClick={onNavigate}
                title={
                  collapsed
                    ? item.badge === 'soon'
                      ? `${item.label} (Coming soon)`
                      : item.label
                    : undefined
                }
                aria-label={item.badge === 'soon' ? `${item.label}, coming soon` : undefined}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium leading-5 tracking-[-0.006em] text-text-main-900 transition-colors',
                  collapsed && 'justify-center px-2',
                  active ? 'bg-neutral-50' : 'hover:bg-neutral-50/60',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                {!collapsed && (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge === 'soon' ? (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-sub-500)] ring-1 ring-inset ring-[var(--stroke-soft-200,#E2E4E9)]">
                        Soon
                      </span>
                    ) : null}
                    {active && <ChevronRight className="h-4 w-4 shrink-0 text-icon-primary" />}
                  </>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      <SidebarSeparator />

      <div>
        <ProfileFooter onNavigate={onNavigate} collapsed={collapsed} />
      </div>
    </div>
  );
}
