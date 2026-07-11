'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Eye, MoreVertical } from 'lucide-react';
import {
  DropdownMenuBackdrop,
  dropdownMenuStyle,
  getDropdownPortalRoot,
  handleDropdownOptionSelect,
  useDropdownMenu,
} from '@/hooks/use-dropdown-menu';

export function RowActionsMenu({
  items,
}: {
  items: Array<{ label: string; href?: string; onClick?: () => void; icon?: ReactNode }>;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const { triggerRef, menuRef, position } = useDropdownMenu({
    open,
    onClose: close,
    align: 'right',
    minWidth: 148,
    maxHeight: 320,
  });

  return (
    <div className="relative">
      <button
        ref={triggerRef}
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

      {open && position && typeof document !== 'undefined' && (
        <>
          <DropdownMenuBackdrop onClose={close} />
          {createPortal(
            <div
              ref={menuRef}
              role="menu"
              data-dropdown-menu
              style={dropdownMenuStyle({
                ...position,
                width: Math.max(position.minWidth ?? 148, 148),
              })}
              className="rounded-[10px] border border-[var(--base-input,#E4E4E7)] bg-white py-1 shadow-md"
              onPointerDown={(event) => event.stopPropagation()}
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
                    onPointerDown={(event) =>
                      handleDropdownOptionSelect(event, () => {
                        item.onClick?.();
                        setOpen(false);
                      })
                    }
                  >
                    {content}
                  </button>
                );
              })}
            </div>,
            getDropdownPortalRoot(),
          )}
        </>
      )}
    </div>
  );
}
