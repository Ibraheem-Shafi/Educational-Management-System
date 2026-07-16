'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Banknote,
  BookOpen,
  Building2,
  CalendarCheck,
  ChevronRight,
  Clock3,
  Info,
  Mail,
  MapPin,
  Phone,
  SquarePen,
  UserPlus,
  Users,
} from 'lucide-react';
import type { BranchDetailResponse, DashboardActivityKind } from '@eims/types';
import { StatusBadge } from '@/components/layout/status-badge';
import { UserAvatar } from '@/components/layout/user-avatar';
import { pageHeaderActionClassName } from '@/components/layout/page-header';
import { formatBranchId, formatBranchPhone } from '@/lib/branch-form';
import { cn } from '@/lib/utils';

const ACTIVITY_STYLES: Record<
  DashboardActivityKind,
  { icon: LucideIcon; iconBg: string; iconColor: string }
> = {
  student: { icon: UserPlus, iconBg: 'bg-[#EFF6FF]', iconColor: 'text-[#2563EB]' },
  teacher: { icon: BookOpen, iconBg: 'bg-[#ECFDF3]', iconColor: 'text-[#16A34A]' },
  fee: { icon: Banknote, iconBg: 'bg-[#FFF7ED]', iconColor: 'text-[#EA580C]' },
  attendance: { icon: CalendarCheck, iconBg: 'bg-[#ECFDF3]', iconColor: 'text-[#16A34A]' },
  branch: { icon: Building2, iconBg: 'bg-[#EFF6FF]', iconColor: 'text-[#2563EB]' },
  report: { icon: BookOpen, iconBg: 'bg-[#F4F4F5]', iconColor: 'text-[#71717A]' },
};

function formatCount(value: number): string {
  return value.toLocaleString('en-US');
}

function formatCreatedDate(iso: string): string {
  const date = new Date(iso);
  const day = date.getDate();
  const suffix =
    day % 10 === 1 && day !== 11
      ? 'st'
      : day % 10 === 2 && day !== 12
        ? 'nd'
        : day % 10 === 3 && day !== 13
          ? 'rd'
          : 'th';

  return `${date.toLocaleDateString('en-US', { month: 'short' })} ${day}${suffix}, ${date.getFullYear()}`;
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = Math.max(0, now.getTime() - date.getTime());
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      <p className="text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-main-900)]">
        {value || '—'}
      </p>
    </div>
  );
}

function ContactRow({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: ReactNode;
}) {
  const className =
    'inline-flex max-w-full items-center gap-2 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)] hover:text-[var(--text-main-900)]';

  if (!href) {
    return (
      <span className={className} title={label}>
        {children}
      </span>
    );
  }

  return (
    <a href={href} className={className} title={label}>
      {children}
    </a>
  );
}

export function BranchDetailView({
  branch,
  onEdit,
}: {
  branch: BranchDetailResponse;
  onEdit: () => void;
}) {
  const locationLabel = branch.addressLabel !== '—' ? branch.addressLabel : branch.city ?? '—';
  const fullAddress = branch.address?.trim() || branch.addressLabel || '—';
  const displayEmail = branch.email ?? '—';
  const displayPhone = branch.phone ? formatBranchPhone(branch.phone) : '—';

  return (
    <div className="space-y-5 font-[family-name:var(--font-inter)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-white">
            <Building2 className="h-[18px] w-[18px] text-[var(--text-main-900)]" strokeWidth={1.5} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <nav className="flex flex-wrap items-center gap-1.5 text-sm leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
                <Link href="/dashboard/branches" className="hover:text-[var(--text-main-900)]">
                  Branches
                </Link>
                <ChevronRight className="h-3.5 w-3.5 text-[var(--text-soft-400,#868C98)]" />
                <span className="font-medium text-[var(--text-main-900)]">
                  View Branch - {formatBranchId(branch.code)}
                </span>
              </nav>
              <StatusBadge
                label={branch.isActive ? 'Active' : 'Inactive'}
                code={branch.isActive ? 'active' : 'inactive'}
              />
            </div>
            <p className="mt-1 text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
              Manage all school branches from one place.
            </p>
          </div>
        </div>

        {branch.isActive ? (
          <button type="button" onClick={onEdit} className={pageHeaderActionClassName}>
            <SquarePen className="h-4 w-4 shrink-0 text-white" strokeWidth={1.75} />
            Edit Branch
          </button>
        ) : null}
      </div>

      <section className="overflow-hidden rounded-[16px] border border-[var(--stroke-soft-200,#E2E4E9)] bg-white px-5 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--stroke-soft-200,#E2E4E9)] bg-[var(--neutral-50)]">
            <Image
              src="/logo.png"
              alt={`${branch.name} logo`}
              width={48}
              height={48}
              className="h-12 w-12 object-contain"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-medium leading-7 tracking-[-0.015em] text-[var(--text-main-900)]">
              {branch.name}
            </h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm leading-5 text-[var(--text-sub-500,#525866)]">
              <MapPin className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{locationLabel}</span>
            </div>
            <div className="mt-3 flex flex-row flex-wrap items-center gap-x-8 gap-y-3">
              <ContactRow
                href={branch.phone ? `tel:${branch.phone}` : undefined}
                label={displayPhone}
              >
                <Phone className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="whitespace-nowrap">{displayPhone}</span>
              </ContactRow>
              <ContactRow
                href={branch.email ? `mailto:${branch.email}` : undefined}
                label={displayEmail}
              >
                <Mail className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                <span className="whitespace-nowrap">{displayEmail}</span>
              </ContactRow>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <DetailCard title="Basic Info" icon={Info}>
            <div className="space-y-5 px-5 py-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <InfoField label="Email" value={displayEmail} />
                <InfoField label="Phone no." value={displayPhone} />
                <InfoField label="City" value={branch.city ?? '—'} />
                <InfoField label="Created on" value={formatCreatedDate(branch.createdAt)} />
              </div>
              <div>
                <p className="text-sm font-normal leading-5 tracking-[-0.006em] text-[var(--text-sub-500,#525866)]">
                  Full Address
                </p>
                <p className="mt-1 text-sm font-medium leading-5 tracking-[-0.006em] text-[var(--text-main-900)]">
                  {fullAddress}
                </p>
              </div>
            </div>
          </DetailCard>

          <DetailCard
            title="All Staff List"
            icon={Users}
            action={
              <Link
                href="/dashboard/users"
                className="font-[family-name:var(--font-inter)] text-base font-medium leading-6 tracking-[-0.011em] text-[var(--midnight-blue-950,#01366C)]"
              >
                + Add Staff
              </Link>
            }
          >
            <div className="divide-y divide-[var(--stroke-soft-200,#E2E4E9)]">
              {branch.staff.length === 0 ? (
                <p className="px-5 py-6 text-sm text-[var(--text-sub-500,#525866)]">
                  No staff assigned to this branch yet.
                </p>
              ) : (
                branch.staff.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 px-5 py-4">
                    <UserAvatar
                      name={member.fullName}
                      gender={member.gender}
                      seed={member.id}
                      size="md"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium leading-5 text-[var(--text-main-900)]">
                        {member.fullName}
                      </p>
                      <p className="truncate text-sm leading-5 text-[var(--text-sub-500,#525866)]">
                        {member.roleName}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </DetailCard>
        </div>

        <div className="space-y-5">
          <DetailCard title="Summary" icon={Building2}>
            <div className="grid grid-cols-3 divide-x divide-[var(--stroke-soft-200,#E2E4E9)] px-2 py-5">
              {[
                { label: 'Students', value: formatCount(branch.studentCount) },
                { label: 'Staff', value: formatCount(branch.staffCount) },
                { label: 'Classes', value: formatCount(branch.classCount) },
              ].map((item) => (
                <div key={item.label} className="px-3 text-center">
                  <p className="text-lg font-medium leading-7 tracking-[-0.015em] text-[var(--text-main-900)]">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs font-normal leading-4 text-[var(--text-sub-500,#525866)]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </DetailCard>

          <DetailCard title="Principal Details" icon={Users}>
            {branch.principal ? (
              <div className="space-y-4 px-5 py-5">
                <div className="flex items-center gap-3">
                  <UserAvatar
                    name={branch.principal.fullName}
                    gender={branch.principal.gender}
                    seed={branch.principal.id}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-5 text-[var(--text-main-900)]">
                      {branch.principal.fullName}
                    </p>
                    <p className="text-sm leading-5 text-[var(--text-sub-500,#525866)]">Principal</p>
                  </div>
                </div>
                <div className="flex flex-row flex-wrap items-center gap-x-8 gap-y-3">
                  <ContactRow
                    href={
                      branch.principal.phone ? `tel:${branch.principal.phone}` : undefined
                    }
                    label={branch.principal.phone ?? 'No phone'}
                  >
                    <Phone className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span className="whitespace-nowrap">{branch.principal.phone ?? '—'}</span>
                  </ContactRow>
                  <ContactRow href={`mailto:${branch.principal.email}`} label={branch.principal.email}>
                    <Mail className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                    <span className="whitespace-nowrap">{branch.principal.email}</span>
                  </ContactRow>
                </div>
              </div>
            ) : (
              <p className="px-5 py-6 text-sm text-[var(--text-sub-500,#525866)]">
                No principal assigned yet.
              </p>
            )}
          </DetailCard>

          <DetailCard title="Recent Activities" icon={Clock3}>
            <div className="px-5 py-4">
              {branch.recentActivities.length === 0 ? (
                <p className="py-4 text-sm text-[var(--text-sub-500,#525866)]">
                  No recent activity yet.
                </p>
              ) : (
                <ul className="space-y-0">
                  {branch.recentActivities.map((activity, index) => {
                    const style = ACTIVITY_STYLES[activity.kind];
                    const Icon = style.icon;
                    const isLast = index === branch.recentActivities.length - 1;

                    return (
                      <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
                        {!isLast && (
                          <span
                            className="absolute left-[17px] top-9 bottom-0 w-px bg-[var(--stroke-soft-200,#E2E4E9)]"
                            aria-hidden
                          />
                        )}
                        <div
                          className={cn(
                            'relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
                            style.iconBg,
                          )}
                        >
                          <Icon className={cn('h-4 w-4', style.iconColor)} strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium leading-5 text-[var(--text-main-900)]">
                                {activity.title}
                              </p>
                              <p className="truncate text-sm leading-5 text-[var(--text-sub-500,#525866)]">
                                {activity.description}
                              </p>
                            </div>
                            <span className="shrink-0 text-xs leading-4 text-[var(--text-soft-400,#868C98)]">
                              {formatRelativeTime(activity.occurredAt)}
                            </span>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </DetailCard>
        </div>
      </div>
    </div>
  );
}

export function BranchDetailSkeleton() {
  return (
    <div className="space-y-5 font-[family-name:var(--font-inter)]">
      <div className="h-16 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
      <div className="h-28 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div className="h-56 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
          <div className="h-72 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
        </div>
        <div className="space-y-5">
          <div className="h-28 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
          <div className="h-48 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
          <div className="h-56 animate-pulse rounded-[16px] bg-[var(--neutral-50)]" />
        </div>
      </div>
    </div>
  );
}
