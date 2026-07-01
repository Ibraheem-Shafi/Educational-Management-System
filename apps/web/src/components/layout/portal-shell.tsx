'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { GraduationCap, LogOut, Home, UserRound, BookOpen } from 'lucide-react';
import { useInstitution } from '@/providers/institution-provider';
import { useAuth } from '@/providers/auth-provider';
import { Button } from '@/components/ui/button';

const mobileNav = [
  { href: '/portal', label: 'Home', icon: Home, match: (p: string) => p === '/portal' },
  {
    href: '/portal/parent',
    label: 'Parent',
    icon: UserRound,
    match: (p: string) => p.includes('/portal/parent'),
    role: 'parent',
  },
  {
    href: '/portal/student',
    label: 'Student',
    icon: BookOpen,
    match: (p: string) => p.includes('/portal/student'),
    role: 'student',
  },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { name, settings } = useInstitution();
  const { user, signOut } = useAuth();
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

  const visibleNav = mobileNav.filter((item) => {
    if (!item.role) return true;
    return user?.roles.includes(item.role);
  });

  return (
    <div className="min-h-screen bg-muted/20 pb-20 md:pb-0">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-[var(--institution-primary)]" />
            <div>
              <p className="font-semibold">{name}</p>
              <p className="text-xs text-muted-foreground">Mobile portal · Add to home screen</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.fullName}</span>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-4 md:p-6">{children}</main>

      <nav className="safe-bottom fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-background md:hidden">
        <div className="mx-auto flex max-w-4xl justify-around py-2">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center gap-1 px-3 py-1 text-xs ${
                  active ? 'text-[var(--institution-primary)]' : 'text-muted-foreground'
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
