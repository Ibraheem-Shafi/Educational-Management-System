'use client';

import type { ReactNode } from 'react';
import { SidebarProvider } from './sidebar-context';
import { Sidebar } from './sidebar';
import { DashboardHeader } from './dashboard-header';
import { StaffGuard } from './staff-guard';
import { AdminMfaGuard } from './admin-mfa-guard';
import { PermissionGuard } from './permission-guard';

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen min-w-0 overflow-hidden">
        <Sidebar />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <DashboardHeader />
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 pb-6 font-[family-name:var(--font-inter)] lg:p-6">
            <StaffGuard>
              <AdminMfaGuard>
                <PermissionGuard>{children}</PermissionGuard>
              </AdminMfaGuard>
            </StaffGuard>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
