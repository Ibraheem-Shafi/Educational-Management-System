'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Check,
  GraduationCap,
  Phone,
  ShieldAlert,
  User,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export const ADMIT_STUDENT_SECTIONS = [
  { id: 'student-information', label: 'Student Information', icon: User },
  { id: 'contact-information', label: 'Contact Information', icon: Phone },
  { id: 'academic-information', label: 'Academic Information', icon: GraduationCap },
  { id: 'guardian-details', label: 'Guardian Details', icon: Users },
  { id: 'emergency-contact', label: 'Emergency Contact', icon: ShieldAlert },
] as const satisfies ReadonlyArray<{
  id: string;
  label: string;
  icon: LucideIcon;
}>;

export type AdmitStudentSectionId = (typeof ADMIT_STUDENT_SECTIONS)[number]['id'];

export function AdmitStudentSideNav({
  activeSection,
  completedSections,
  onNavigate,
}: {
  activeSection: AdmitStudentSectionId;
  completedSections: Set<AdmitStudentSectionId>;
  onNavigate: (id: AdmitStudentSectionId) => void;
}) {
  return (
    <aside className="hidden w-[232px] shrink-0 self-start lg:sticky lg:top-6 lg:block">
      <p className="mb-4 text-xs font-medium uppercase leading-4 tracking-[0.04em] text-text-soft-400">
        On this page
      </p>
      <nav className="flex flex-col gap-1" aria-label="Form sections">
        {ADMIT_STUDENT_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const isComplete = completedSections.has(section.id) && !isActive;

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onNavigate(section.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                isActive
                  ? 'bg-neutral-50 shadow-[0px_1px_2px_rgba(82,88,102,0.06)]'
                  : 'bg-transparent hover:bg-neutral-50/60',
              )}
            >
              {isComplete ? (
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-midnight-blue-950 text-white">
                  <Check className="h-3 w-3" strokeWidth={2.5} aria-hidden />
                </span>
              ) : (
                <Icon
                  className={cn(
                    'h-[18px] w-[18px] shrink-0',
                    isActive ? 'text-midnight-blue-950' : 'text-text-sub-500',
                  )}
                  strokeWidth={1.5}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'text-sm leading-5 tracking-[-0.006em]',
                  isActive
                    ? 'font-medium text-midnight-blue-950'
                    : 'font-normal text-text-sub-500',
                )}
              >
                {section.label}
              </span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

export function AdmitStudentSection({
  id,
  title,
  description,
  children,
}: {
  id: AdmitStudentSectionId;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-24 overflow-hidden rounded-[16px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white"
    >
      <div className="border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
        <h2 className="text-base font-medium leading-6 tracking-[-0.011em] text-[var(--text-main-900)]">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
            {description}
          </p>
        ) : null}
      </div>
      <div className="space-y-4 px-5 py-5">{children}</div>
    </section>
  );
}

export function AdmitFieldGrid({
  children,
  columns = 2,
}: {
  children: ReactNode;
  columns?: 1 | 2;
}) {
  return (
    <div
      className={cn(
        'grid gap-4',
        columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1',
      )}
    >
      {children}
    </div>
  );
}
