'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  LayoutDashboard,
  Users,
  LogOut,
  Building2,
  BookOpen,
  UserCog,
  ClipboardCheck,
  FileText,
  Wallet,
  UserRound,
  Bell,
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
} from 'lucide-react';
import { useInstitution } from '@/providers/institution-provider';
import { useAuth } from '@/providers/auth-provider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LinkButton } from '@/components/ui/link-button';

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dashboard/students', label: 'Students', icon: Users, permission: 'students.read' },
  { href: '/dashboard/attendance', label: 'Attendance', icon: ClipboardCheck, permission: 'attendance.read' },
  { href: '/dashboard/assessments', label: 'Assessments', icon: FileText, permission: 'assessments.read' },
  { href: '/dashboard/fees', label: 'Fees', icon: Wallet, permission: 'fees.read' },
  { href: '/dashboard/timetable', label: 'Timetable', icon: Calendar, permission: 'timetable.read' },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.read' },
  { href: '/dashboard/reports', label: 'Reports', icon: FileBarChart, permission: 'reports.view' },
  { href: '/dashboard/documents', label: 'Documents', icon: FolderOpen, permission: 'documents.read' },
  { href: '/dashboard/parents', label: 'Parents', icon: UserRound, permission: 'students.read' },
  { href: '/dashboard/notices', label: 'Notices', icon: Bell, permission: 'students.read' },
  { href: '/dashboard/academic', label: 'Academic', icon: BookOpen, permission: 'academic.read' },
  { href: '/dashboard/branches', label: 'Branches', icon: Building2, permission: 'branches.read' },
  { href: '/dashboard/users', label: 'Users', icon: UserCog, permission: 'users.manage' },
  { href: '/dashboard/audit', label: 'Audit', icon: Shield, permission: 'audit.read' },
  { href: '/dashboard/ai-insights', label: 'AI Insights', icon: Sparkles, permission: 'ai_insights.read' },
  { href: '/dashboard/ai-attendance', label: 'AI Attendance', icon: ScanLine, permission: 'ai_attendance.use' },
  { href: '/dashboard/communications', label: 'Communications', icon: MessageSquare, permission: 'communications.send' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, permission: 'settings.manage' },
  { href: '/dashboard/form-fields', label: 'Form fields', icon: FormInput, permission: 'form_fields.manage' },
];

function isNavItemActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') {
    return pathname === '/dashboard' || pathname === '/dashboard/';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { name, logoUrl } = useInstitution();
  const { user, signOut } = useAuth();

  const visibleItems = navItems.filter(
    (item) => !item.permission || user?.permissions.includes(item.permission),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 border-b border-border p-4">
        {logoUrl && !logoUrl.startsWith('storage://') ? (
          <Image src={logoUrl} alt={name} width={32} height={32} className="rounded" />
        ) : (
          <GraduationCap className="h-8 w-8 shrink-0 text-[var(--institution-primary)]" />
        )}
        <span className="truncate font-semibold leading-tight">{name}</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const active = isNavItemActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-[var(--institution-primary)] text-white'
                  : 'text-foreground hover:bg-muted',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border p-4">
        <p className="truncate text-sm font-medium">{user?.fullName}</p>
        <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
        <LinkButton
          href="/dashboard/profile"
          onClick={onNavigate}
          className="mt-2 w-full justify-start"
        >
          <UserRound className="mr-2 h-4 w-4" />
          My profile
        </LinkButton>
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={signOut}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  );
}
