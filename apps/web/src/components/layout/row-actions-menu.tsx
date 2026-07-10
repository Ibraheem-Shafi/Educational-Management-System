'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Eye, MoreVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RowActionsMenu({
  items,
}: {
  items: Array<{ label: string; href?: string; onClick?: () => void; icon?: ReactNode }>;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label="Row actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-soft-400)] transition-colors hover:bg-[var(--neutral-50)] hover:text-[var(--text-main-900)]"
      >
        <MoreVertical className="h-4 w-4" strokeWidth={1.75} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[148px] rounded-[10px] border border-[var(--base-input,#E4E4E7)] bg-white py-1 shadow-md"
        >
          {items.map((item) => {
            const content = (
              <>
                {item.icon ?? (
                  <Eye
                    className="h-4 w-4 shrink-0 text-[var(--text-soft-400,#868C98)]"
                    strokeWidth={1.5}
                  />
                )}
                <span>{item.label}</span>
              </>
            );

            const itemClass =
              'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--text-main-900,#0A0D14)] hover:bg-[var(--neutral-50)]';

            return item.href ? (
              <Link
                key={item.label}
                href={item.href}
                role="menuitem"
                className={itemClass}
                onClick={() => setOpen(false)}
              >
                {content}
              </Link>
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={itemClass}
                onClick={() => {
                  item.onClick?.();
                  setOpen(false);
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
