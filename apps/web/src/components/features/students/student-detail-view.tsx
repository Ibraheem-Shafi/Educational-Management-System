'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarCheck,
  ChevronRight,
  FileText,
  GraduationCap,
  Mail,
  Phone,
  SquarePen,
  User,
} from 'lucide-react';
import { StatusBadge } from '@/components/layout/status-badge';
import { UserAvatar } from '@/components/layout/user-avatar';
import { pageHeaderActionClassName } from '@/components/layout/page-header';
import { cn } from '@/lib/utils';

export interface StudentDetailData {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  cnicOrBForm: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  photographUrl: string | null;
  batch?: { name: string };
  program?: { name: string };
  status?: { code: string; label: string };
  customFields?: Record<string, unknown>;
}

function DetailCard({
  title,
  icon: Icon,
  action,
  children,
  className,
}: {
  title: string;
  icon: LucideIcon;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-[16px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Icon className="h-4 w-4 text-[var(--text-sub-500,#525866)]" strokeWidth={1.5} />
          </div>
          <h2 className="text-base font-medium leading-6 tracking-[-0.011em] text-[var(--text-main-900)]">
            {title}
          </h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-normal leading-5 text-[var(--text-sub-500,#525866)]">{label}</p>
      <p className="mt-1 text-sm font-medium leading-5 text-[var(--text-main-900)]">{value || '—'}</p>
    </div>
  );
}

export function StudentDetailView({
  student,
  onEdit,
  subjectsSection,
  documentsSection,
  certificatesSection,
  attendanceSection,
  customFieldsSection,
}: {
  student: StudentDetailData;
  onEdit?: () => void;
  subjectsSection?: ReactNode;
  documentsSection?: ReactNode;
  certificatesSection?: ReactNode;
  attendanceSection?: ReactNode;
  customFieldsSection?: ReactNode;
}) {
  const dob = student.dateOfBirth
    ? new Date(student.dateOfBirth).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <div className="space-y-5 font-[family-name:var(--font-inter)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <GraduationCap className="h-[18px] w-[18px] text-[var(--text-main-900)]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <nav className="flex flex-wrap items-center gap-1.5 text-sm text-[var(--text-sub-500,#525866)]">
                <Link href="/dashboard/students" className="hover:text-[var(--text-main-900)]">
                  Students
                </Link>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-soft-400,#868C98)]" />
                <span className="font-medium text-[var(--text-main-900)]">
                  {student.fullName}
                </span>
              </nav>
              {student.status && (
                <StatusBadge label={student.status.label} code={student.status.code} />
              )}
            </div>
            <p className="mt-1 text-sm text-[var(--text-sub-500,#525866)]">
              {student.program?.name ?? '—'} · {student.batch?.name ?? '—'}
            </p>
          </div>
        </div>
        {onEdit && (
          <button type="button" onClick={onEdit} className={pageHeaderActionClassName}>
            <SquarePen className="h-4 w-4 shrink-0 text-white" strokeWidth={1.75} />
            Edit student
          </button>
        )}
      </div>

      <section className="overflow-hidden rounded-[16px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white p-5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <UserAvatar
            name={student.fullName}
            src={student.photographUrl}
            gender={student.gender}
            seed={student.id}
            size="lg"
          />
          <div className="grid flex-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <InfoField label="Program" value={student.program?.name ?? '—'} />
            <InfoField label="Batch" value={student.batch?.name ?? '—'} />
            <InfoField label="Gender" value={student.gender ?? '—'} />
            <InfoField label="Date of birth" value={dob} />
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <DetailCard title="Personal information" icon={User}>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <InfoField label="Full name" value={student.fullName} />
            <InfoField label="CNIC / B-Form" value={student.cnicOrBForm ?? '—'} />
            <InfoField label="Phone" value={student.phone ?? '—'} />
            <InfoField label="Email" value={student.email ?? '—'} />
            <InfoField label="Address" value={student.address ?? '—'} />
          </div>
          <div className="flex flex-wrap gap-4 border-t border-[var(--stroke-soft-200,#E2E4E9)] px-5 py-4">
            {student.phone && (
              <a href={`tel:${student.phone}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-sub-500)]">
                <Phone className="h-4 w-4" /> Call
              </a>
            )}
            {student.email && (
              <a href={`mailto:${student.email}`} className="inline-flex items-center gap-2 text-sm text-[var(--text-sub-500)]">
                <Mail className="h-4 w-4" /> Email
              </a>
            )}
          </div>
        </DetailCard>

        <DetailCard title="Academic" icon={BookOpen}>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <InfoField label="Program" value={student.program?.name ?? '—'} />
            <InfoField label="Batch" value={student.batch?.name ?? '—'} />
            <InfoField label="Status" value={student.status?.label ?? '—'} />
          </div>
          {subjectsSection && <div className="border-t border-[var(--stroke-soft-200,#E2E4E9)] p-5">{subjectsSection}</div>}
        </DetailCard>

        {customFieldsSection && (
          <DetailCard title="Additional information" icon={FileText} className="lg:col-span-2">
            <div className="p-5">{customFieldsSection}</div>
          </DetailCard>
        )}

        {documentsSection && (
          <DetailCard title="Documents" icon={FileText} className="lg:col-span-2">
            <div className="p-5">{documentsSection}</div>
          </DetailCard>
        )}

        {certificatesSection && (
          <DetailCard title="Certificates & ID" icon={FileText} className="lg:col-span-2">
            <div className="p-5">{certificatesSection}</div>
          </DetailCard>
        )}

        {attendanceSection && (
          <DetailCard title="Attendance history" icon={CalendarCheck} className="lg:col-span-2">
            <div className="p-5">{attendanceSection}</div>
          </DetailCard>
        )}
      </div>
    </div>
  );
}
