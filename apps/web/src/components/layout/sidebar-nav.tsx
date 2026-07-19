'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  Building2,
  BookOpen,
  BookMarked,
  Library,
  UserCog,
  ClipboardCheck,
  FileText,
  Wallet,
  Calculator,
  UserRound,
  Bell,
  ClipboardList,
  Headset,
  Shield,
  Settings,
  Calendar,
  BarChart3,
  FileBarChart,
  FolderOpen,
  FormInput,
  ScanLine,
  MessageSquare,
  Sparkles,
  Award,
  Banknote,
  Bus,
  Fingerprint,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useInstitution } from '@/providers/institution-provider';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { useSidebar } from './sidebar-context';
import { UserAvatar } from './user-avatar';

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: string;
};

export type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

/** Top-level item shown above collapsible groups. */
export const overviewNavItem: NavItem = {
  href: '/dashboard',
  label: 'Dashboard',
  icon: LayoutDashboard,
};

export const navGroups: NavGroup[] = [
  {
    id: 'people',
    label: 'People',
    items: [
      { href: '/dashboard/students', label: 'Students', icon: Users, permission: 'students.read' },
      { href: '/dashboard/parents', label: 'Parents', icon: UserRound, permission: 'students.read' },
      { href: '/dashboard/users', label: 'Users', icon: UserCog, permission: 'users.manage' },
      { href: '/dashboard/front-office', label: 'Front office', icon: Headset, permission: 'front_office.read' },
    ],
  },
  {
    id: 'academics',
    label: 'Academics',
    items: [
      { href: '/dashboard/academic', label: 'Academic', icon: BookOpen, permission: 'academic.read' },
      { href: '/dashboard/assessments', label: 'Assessments', icon: FileText, permission: 'assessments.read' },
      { href: '/dashboard/timetable', label: 'Timetable', icon: Calendar, permission: 'timetable.read' },
      { href: '/dashboard/learning', label: 'Learning', icon: BookMarked, permission: 'learning.read' },
      { href: '/dashboard/attendance', label: 'Attendance', icon: ClipboardCheck, permission: 'attendance.read' },
      { href: '/dashboard/leave-requests', label: 'Leave requests', icon: ClipboardList, permission: 'leave.request' },
    ],
  },
  {
    id: 'finance',
    label: 'Finance',
    items: [
      { href: '/dashboard/fees', label: 'Fees', icon: Wallet, permission: 'fees.read' },
      { href: '/dashboard/accounting', label: 'Accounting', icon: Calculator, permission: 'accounting.read' },
      { href: '/dashboard/payroll', label: 'Payroll', icon: Banknote, permission: 'payroll.read' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    items: [
      { href: '/dashboard/library', label: 'Library', icon: Library, permission: 'library.read' },
      { href: '/dashboard/transport', label: 'Transport', icon: Bus, permission: 'transport.read' },
      { href: '/dashboard/biometric', label: 'Biometric', icon: Fingerprint, permission: 'biometric.read' },
      { href: '/dashboard/documents', label: 'Documents', icon: FolderOpen, permission: 'documents.read' },
      { href: '/dashboard/certificates', label: 'Certificates', icon: Award, permission: 'certificates.read' },
    ],
  },
  {
    id: 'insights',
    label: 'Insights',
    items: [
      { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.read' },
      { href: '/dashboard/reports', label: 'Reports', icon: FileBarChart, permission: 'reports.view' },
      { href: '/dashboard/ai-insights', label: 'AI Insights', icon: Sparkles, permission: 'ai_insights.read' },
      { href: '/dashboard/ai-attendance', label: 'AI Attendance', icon: ScanLine, permission: 'ai_attendance.use' },
    ],
  },
  {
    id: 'communication',
    label: 'Communication',
    items: [
      { href: '/dashboard/notices', label: 'Notices', icon: Bell, permission: 'students.read' },
      {
        href: '/dashboard/communications',
        label: 'Communications',
        icon: MessageSquare,
        permission: 'communications.send',
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    items: [
      { href: '/dashboard/branches', label: 'Branches', icon: Building2, permission: 'branches.read' },
      { href: '/dashboard/audit', label: 'Audit', icon: Shield, permission: 'audit.read' },
      { href: '/dashboard/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
      { href: '/dashboard/form-fields', label: 'Form fields', icon: FormInput, permission: 'form_fields.manage' },
    ],
  },
];

/** Flat list kept for any consumers that still import `navItems`. */
export const navItems: NavItem[] = [overviewNavItem, ...navGroups.flatMap((group) => group.items)];

const OPEN_GROUPS_STORAGE_KEY = 'sidebar-nav-open-groups';

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/dashboard/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function groupContainsActivePath(group: NavGroup, pathname: string): boolean {
  return group.items.some((item) => isNavItemActive(pathname, item.href));
}

function readStoredOpenGroups(): Record<string, boolean> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OPEN_GROUPS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredOpenGroups(state: Record<string, boolean>) {
  try {
    window.localStorage.setItem(OPEN_GROUPS_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}

function canSeeItem(item: NavItem, permissions: string[] | undefined): boolean {
  return !item.permission || !!permissions?.includes(item.permission);
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

  const handleProfile = () => {
    setOpen(false);
    onNavigate?.();
    router.push('/dashboard/profile');
  };

  const handleSignOut = async () => {
    setOpen(false);
    onNavigate?.();
    await signOut();
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
            onClick={handleProfile}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-main-900 hover:bg-neutral-50"
          >
            <UserRound className="h-4 w-4 text-icon-primary" />
            My profile
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

function NavLinkItem({
  item,
  pathname,
  collapsed,
  onNavigate,
  nested,
}: {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
  nested?: boolean;
}) {
  const Icon = item.icon;
  const active = isNavItemActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cn(
        'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium leading-5 tracking-[-0.006em] text-text-main-900 transition-colors',
        collapsed && 'justify-center px-2',
        nested && !collapsed && 'pl-3',
        active ? 'bg-neutral-50' : 'hover:bg-neutral-50/60',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {active && <ChevronRight className="h-4 w-4 shrink-0 text-icon-primary" />}
        </>
      )}
    </Link>
  );
}

function NavGroupSection({
  group,
  open,
  onToggle,
  pathname,
  onNavigate,
}: {
  group: NavGroup;
  open: boolean;
  onToggle: () => void;
  pathname: string;
  onNavigate?: () => void;
}) {
  const hasActive = groupContainsActivePath(group, pathname);
  const panelId = `sidebar-group-${group.id}`;

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={cn(
          'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors hover:bg-neutral-50/60',
          hasActive && !open && 'bg-neutral-50/40',
        )}
      >
        <span
          className={cn(
            'flex-1 truncate text-xs font-medium uppercase leading-4 tracking-[0.04em]',
            hasActive ? 'text-text-sub-500' : 'text-text-soft-400',
          )}
        >
          {group.label}
        </span>
        <ChevronDown
          className={cn(
            'h-3.5 w-3.5 shrink-0 text-text-soft-400 transition-transform duration-200',
            open && 'rotate-180',
          )}
          strokeWidth={2}
        />
      </button>
      {open && (
        <div id={panelId} role="group" aria-label={group.label} className="space-y-0.5">
          {group.items.map((item) => (
            <NavLinkItem
              key={item.href}
              item={item}
              pathname={pathname}
              collapsed={false}
              onNavigate={onNavigate}
              nested
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { collapsed: contextCollapsed, forceExpanded } = useSidebar();
  const collapsed = forceExpanded ? false : contextCollapsed;

  const visibleGroups = useMemo(
    () =>
      navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => canSeeItem(item, user?.permissions)),
        }))
        .filter((group) => group.items.length > 0),
    [user?.permissions],
  );

  const showOverview = canSeeItem(overviewNavItem, user?.permissions);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of navGroups) {
      initial[group.id] = false;
    }
    return initial;
  });
  const hydratedRef = useRef(false);

  useEffect(() => {
    const stored = readStoredOpenGroups();
    const next: Record<string, boolean> = {};
    for (const group of navGroups) {
      const fromStore = stored?.[group.id];
      next[group.id] =
        typeof fromStore === 'boolean' ? fromStore : groupContainsActivePath(group, pathname);
    }
    // Always keep the active route's group open
    for (const group of navGroups) {
      if (groupContainsActivePath(group, pathname)) {
        next[group.id] = true;
      }
    }
    setOpenGroups(next);
    hydratedRef.current = true;
    // Intentional: hydrate once on mount from storage + current path
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydratedRef.current) return;
    setOpenGroups((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const group of navGroups) {
        if (groupContainsActivePath(group, pathname) && !next[group.id]) {
          next[group.id] = true;
          changed = true;
        }
      }
      if (changed) writeStoredOpenGroups(next);
      return changed ? next : prev;
    });
  }, [pathname]);

  const toggleGroup = (groupId: string) => {
    setOpenGroups((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      writeStoredOpenGroups(next);
      return next;
    });
  };

  const flatVisibleItems = useMemo(() => {
    const items: NavItem[] = [];
    if (showOverview) items.push(overviewNavItem);
    for (const group of visibleGroups) items.push(...group.items);
    return items;
  }, [showOverview, visibleGroups]);

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
        {collapsed ? (
          <div className="space-y-0.5">
            {flatVisibleItems.map((item) => (
              <NavLinkItem
                key={item.href}
                item={item}
                pathname={pathname}
                collapsed
                onNavigate={onNavigate}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {showOverview && (
              <div className="space-y-0.5">
                <p className="mb-1 px-3 text-xs font-medium uppercase leading-4 tracking-[0.04em] text-text-soft-400">
                  Overview
                </p>
                <NavLinkItem
                  item={overviewNavItem}
                  pathname={pathname}
                  collapsed={false}
                  onNavigate={onNavigate}
                />
              </div>
            )}

            {visibleGroups.map((group) => (
              <NavGroupSection
                key={group.id}
                group={group}
                open={!!openGroups[group.id]}
                onToggle={() => toggleGroup(group.id)}
                pathname={pathname}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </nav>

      <SidebarSeparator />

      <div>
        <ProfileFooter onNavigate={onNavigate} collapsed={collapsed} />
      </div>
    </div>
  );
}
