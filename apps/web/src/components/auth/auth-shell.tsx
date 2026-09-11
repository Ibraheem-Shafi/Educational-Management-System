'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const authPrimaryButtonClassName = cn(
  'h-11 w-full rounded-xl bg-gradient-to-r from-[var(--palette-navy)] via-[var(--palette-teal)] to-[var(--palette-green)]',
  'text-sm font-semibold tracking-[-0.01em] text-white shadow-[0_10px_24px_rgba(13,155,138,0.28)]',
  'transition hover:brightness-110',
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--palette-teal)] focus-visible:ring-offset-2',
  'disabled:cursor-not-allowed disabled:opacity-60 disabled:shadow-none',
);

export const authFieldClassName = cn(
  'h-11 rounded-xl border border-[var(--stroke-soft-200,#E2E4E9)] bg-white',
  'px-3.5 text-sm text-[var(--text-main-900,#0A0D14)] shadow-none',
  'placeholder:text-[var(--text-soft-400,#868C98)]',
  'focus-visible:border-[var(--palette-teal)] focus-visible:ring-2 focus-visible:ring-[var(--palette-teal)]/30',
);

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex h-dvh max-h-dvh items-center justify-center overflow-hidden bg-[var(--bg-weak-50,#F6F8FA)] p-4 font-[family-name:var(--font-inter)] sm:p-6">
      <div className="flex h-full max-h-[640px] w-full max-w-[480px] overflow-hidden rounded-2xl border border-[var(--stroke-soft-200,#E2E4E9)] bg-white shadow-[0_16px_48px_rgba(15,23,42,0.08)] lg:max-w-[980px] lg:flex-row">
        <aside className="relative hidden min-h-0 w-1/2 overflow-hidden bg-[var(--palette-navy)] lg:block">
          <Image
            src="/form-image.png"
            alt="Nexium Technologies Education Management System"
            fill
            priority
            className="object-cover object-top"
            sizes="490px"
          />
        </aside>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 py-5 sm:px-8 lg:w-1/2 lg:px-10 xl:px-12">
          <div className="w-full max-w-[360px]">
            <div className="mb-6 space-y-1.5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--palette-teal)]">
                Nexium Technologies
              </p>
              <h1 className="text-[24px] font-semibold leading-tight tracking-[-0.03em] text-[#0A0D14]">
                {title}
              </h1>
              <p className="text-sm leading-5 text-[#5B6578]">{description}</p>
            </div>

            {children}

            {footer ? <div className="mt-5">{footer}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
