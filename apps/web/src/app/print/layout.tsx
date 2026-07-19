import type { ReactNode } from 'react';
import { AppProviders } from '@/providers/app-providers';

export default function PrintLayout({ children }: { children: ReactNode }) {
  return (
    <AppProviders>
      <div className="min-h-screen bg-white font-[family-name:var(--font-inter)] text-[var(--text-main-900)]">
        {children}
      </div>
    </AppProviders>
  );
}
