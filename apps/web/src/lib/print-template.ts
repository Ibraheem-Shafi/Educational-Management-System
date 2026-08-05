import { formatCurrency } from '@eims/shared';
import type { ReactNode } from 'react';

export type PrintTemplateConfig = {
  paperSize?: string;
  fields?: Record<string, boolean>;
  headerText?: string | null;
  footerText?: string | null;
  extraNote?: string | null;
};

export function fieldVisible(template: PrintTemplateConfig | null | undefined, key: string, fallback = true): boolean {
  if (!template?.fields || !(key in template.fields)) return fallback;
  return Boolean(template.fields[key]);
}

export function paperPageCss(paperSize?: string): string {
  switch (paperSize) {
    case 'a5':
      return '@page { size: A5; margin: 10mm; }';
    case 'thermal80':
      return '@page { size: 80mm auto; margin: 4mm; }';
    default:
      return '@page { size: A4; margin: 12mm; }';
  }
}

export function paperContainerClass(paperSize?: string): string {
  switch (paperSize) {
    case 'a5':
      return 'mx-auto max-w-[148mm]';
    case 'thermal80':
      return 'mx-auto max-w-[80mm] text-xs';
    default:
      return 'mx-auto max-w-[210mm]';
  }
}

export { formatCurrency };
export type { ReactNode };
