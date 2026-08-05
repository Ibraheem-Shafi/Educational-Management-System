'use client';

import type { ReactNode } from 'react';
import { paperContainerClass, paperPageCss, type PrintTemplateConfig } from '@/lib/print-template';

/**
 * Derive loading/error for print pages that wait on auth before enabling a query.
 * Without this, a disabled query (no token yet) looks like `!isLoading && !data`
 * and briefly flashes "Unable to load …".
 */
export function printQueryUiState(opts: {
  authLoading: boolean;
  hasToken: boolean;
  /** Extra gates (ids, filters). Default true. */
  ready?: boolean;
  isLoading: boolean;
  isPending?: boolean;
  error: unknown;
  data: unknown;
}): { loading: boolean; error: boolean } {
  const ready = opts.ready ?? true;
  if (opts.authLoading) return { loading: true, error: false };
  if (!opts.hasToken) return { loading: false, error: true };
  if (!ready) return { loading: true, error: false };
  if (opts.error) return { loading: false, error: true };
  if (opts.data) return { loading: false, error: false };
  if (opts.isLoading || opts.isPending) return { loading: true, error: false };
  return { loading: false, error: true };
}

export function PrintShell({
  title,
  template,
  children,
  loading,
  error,
}: {
  title: string;
  template?: PrintTemplateConfig | null;
  children?: ReactNode;
  loading?: boolean;
  error?: boolean;
}) {
  if (loading) {
    return <p className="p-8 text-center text-sm text-[var(--text-sub-500)]">Preparing {title}…</p>;
  }
  if (error) {
    return <p className="p-8 text-center text-sm text-red-600">Unable to load {title}</p>;
  }

  return (
    <div className="p-4 sm:p-8">
      <style>{`${paperPageCss(template?.paperSize)}
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
        }
      `}</style>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--text-sub-500,#71717A)]">{title}</p>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-[var(--primary-base,#2563EB)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          Print again
        </button>
      </div>
      <div className={paperContainerClass(template?.paperSize)}>{children}</div>
    </div>
  );
}

export function PrintInstitutionHeader({
  institution,
  showLogo = true,
  subtitle,
  headerText,
}: {
  institution: {
    name: string;
    logoUrl?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
  };
  showLogo?: boolean;
  subtitle?: string;
  headerText?: string | null;
}) {
  return (
    <header className="mb-4 border-b border-neutral-200 pb-3 text-center">
      {showLogo && institution.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={institution.logoUrl} alt="" className="mx-auto mb-2 h-14 w-auto object-contain" />
      ) : null}
      <h1 className="text-lg font-semibold tracking-tight">{institution.name}</h1>
      {institution.address ? <p className="text-xs text-neutral-600">{institution.address}</p> : null}
      {(institution.phone || institution.email) && (
        <p className="text-xs text-neutral-600">
          {[institution.phone, institution.email].filter(Boolean).join(' · ')}
        </p>
      )}
      {headerText ? <p className="mt-1 text-xs font-medium text-neutral-700">{headerText}</p> : null}
      {subtitle ? <p className="mt-2 text-sm font-semibold uppercase tracking-wide">{subtitle}</p> : null}
    </header>
  );
}

export function PrintFooter({ footerText, extraNote }: { footerText?: string | null; extraNote?: string | null }) {
  if (!footerText && !extraNote) return null;
  return (
    <footer className="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-600">
      {extraNote ? <p className="mb-1 whitespace-pre-wrap">{extraNote}</p> : null}
      {footerText ? <p>{footerText}</p> : null}
    </footer>
  );
}
