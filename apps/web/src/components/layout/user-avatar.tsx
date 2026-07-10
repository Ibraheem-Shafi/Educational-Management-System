import Image from 'next/image';
import { ProfilePlaceholder } from '@/components/layout/profile-placeholder';
import { cn } from '@/lib/utils';

export function UserAvatar({
  name,
  src,
  gender: _gender,
  seed: _seed,
  className,
  size = 'md',
}: {
  name: string | undefined;
  src?: string | null;
  /** Reserved for future use; placeholder is now the default dummy avatar. */
  gender?: string | null;
  /** Reserved for future use; placeholder is now the default dummy avatar. */
  seed?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'sm' ? 'h-8 w-8' : size === 'lg' ? 'h-24 w-24' : 'h-9 w-9';
  const pixelSize = size === 'sm' ? 32 : size === 'lg' ? 96 : 36;

  const hasCustomPhoto = src && !src.startsWith('storage://');

  if (hasCustomPhoto) {
    return (
      <Image
        src={src}
        alt={name ?? 'Avatar'}
        width={pixelSize}
        height={pixelSize}
        className={cn(
          'shrink-0 rounded-full object-cover ring-1 ring-stroke-soft-200',
          sizeClass,
          className,
        )}
      />
    );
  }

  return (
    <ProfilePlaceholder
      title={name ? `${name} avatar` : 'Profile placeholder'}
      className={cn('ring-1 ring-stroke-soft-200', sizeClass, className)}
    />
  );
}
