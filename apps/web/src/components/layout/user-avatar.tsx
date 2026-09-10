import Image from 'next/image';
import { accentForSeed, paletteColor } from '@/lib/ui-palette';
import { cn } from '@/lib/utils';

function initialsFromName(name: string | undefined): string {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function UserAvatar({
  name,
  src,
  className,
  size = 'md',
  seed,
}: {
  name: string | undefined;
  src?: string | null;
  /** Reserved for future use; placeholder is now the default dummy avatar. */
  gender?: string | null;
  seed?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass =
    size === 'sm' ? 'h-8 w-8 text-[10px]' : size === 'lg' ? 'h-24 w-24 text-2xl' : 'h-9 w-9 text-xs';
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
          'shrink-0 rounded-full object-cover ring-2 ring-white',
          sizeClass,
          className,
        )}
      />
    );
  }

  const accent = accentForSeed(seed ?? name ?? 'user');

  return (
    <span
      aria-label={name ? `${name} avatar` : 'Profile placeholder'}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-wide text-white',
        sizeClass,
        className,
      )}
      style={{ backgroundColor: paletteColor(accent) }}
    >
      {initialsFromName(name)}
    </span>
  );
}
