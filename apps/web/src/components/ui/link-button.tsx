import Link from 'next/link';
import type { ComponentProps } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';

type LinkButtonProps = Omit<ComponentProps<typeof Link>, 'href'> &
  Pick<ButtonProps, 'variant' | 'size' | 'className'> & {
    href: ComponentProps<typeof Link>['href'];
  };

export function LinkButton({
  href,
  variant = 'outline',
  size = 'sm',
  className,
  children,
  ...linkProps
}: LinkButtonProps) {
  return (
    <Button variant={variant} size={size} className={className} asChild>
      <Link href={href} {...linkProps}>
        {children}
      </Link>
    </Button>
  );
}
