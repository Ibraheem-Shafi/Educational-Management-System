import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ListRow } from './list-row';

type ListRowLinkProps = {
  href: ComponentProps<typeof Link>['href'];
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function ListRowLink({ href, children, actions, className }: ListRowLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        'block rounded-md transition-colors',
        'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--institution-primary)] focus-visible:ring-offset-2',
        className,
      )}
    >
      <ListRow actions={actions}>{children}</ListRow>
    </Link>
  );
}
