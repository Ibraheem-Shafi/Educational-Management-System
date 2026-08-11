'use client';

import { useCallback, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import {
  CircleDollarSign,
  ClipboardCheck,
  ClipboardPen,
  CreditCard,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  LogOut,
  MoreVertical,
  Pencil,
  RotateCcw,
  Send,
  ShieldOff,
  Trash2,
  Undo2,
  Unlink,
  UserCheck,
  UserX,
  CheckCircle,
  Download,
  Printer,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenuBackdrop,
  dropdownMenuStyle,
  getDropdownPortalRoot,
  handleDropdownOptionSelect,
  useDropdownMenu,
} from '@/hooks/use-dropdown-menu';

export const rowActionIconClass = 'h-4 w-4 shrink-0 text-[var(--text-soft-400,#868C98)]';
export const rowActionDestructiveIconClass = 'h-4 w-4 shrink-0 text-red-500';

function renderActionIcon(Icon: LucideIcon, destructive = false) {
  return (
    <Icon
      className={destructive ? rowActionDestructiveIconClass : rowActionIconClass}
      strokeWidth={1.5}
    />
  );
}

export function getDefaultActionIcon(label: string): ReactNode | null {
  const key = label.trim().toLowerCase();

  if (key.startsWith('view')) {
    return renderActionIcon(Eye);
  }

  const exactMatches: Record<string, ReactNode> = {
    edit: renderActionIcon(Pencil),
    'edit branch': renderActionIcon(Pencil),
    open: renderActionIcon(ExternalLink),
    remove: renderActionIcon(Trash2, true),
    delete: renderActionIcon(Trash2, true),
    cancel: renderActionIcon(Trash2, true),
    publish: renderActionIcon(Send),
    'publish now': renderActionIcon(Send),
    unpublish: renderActionIcon(EyeOff),
    deactivate: renderActionIcon(UserX, true),
    reactivate: renderActionIcon(UserCheck),
    revoke: renderActionIcon(ShieldOff, true),
    unlink: renderActionIcon(Unlink, true),
    'record payment': renderActionIcon(CreditCard),
    'pay in full': renderActionIcon(CircleDollarSign),
    'enter marks': renderActionIcon(ClipboardPen),
    'submit for review': renderActionIcon(Send),
    convert: renderActionIcon(GraduationCap),
    'check out': renderActionIcon(LogOut),
    renew: renderActionIcon(RotateCcw),
    return: renderActionIcon(Undo2),
    fulfill: renderActionIcon(CheckCircle),
    post: renderActionIcon(CheckCircle),
    unpost: renderActionIcon(Undo2),
    'mark attendance': renderActionIcon(ClipboardCheck),
    adjust: renderActionIcon(Pencil),
    export: renderActionIcon(Download),
    download: renderActionIcon(Download),
    approve: renderActionIcon(CheckCircle),
    reject: renderActionIcon(Trash2, true),
    'mark paid': renderActionIcon(CircleDollarSign),
    waive: renderActionIcon(ShieldOff),
    print: renderActionIcon(Printer),
  };

  if (exactMatches[key]) return exactMatches[key];

  if (key.includes('delete') || key.includes('remove') || key.includes('cancel')) {
    return renderActionIcon(Trash2, true);
  }
  if (key.includes('unlink')) return renderActionIcon(Unlink, true);
  if (key.includes('revoke')) return renderActionIcon(ShieldOff, true);
  if (key.includes('reactivate')) return renderActionIcon(UserCheck);
  if (key.includes('deactivate')) return renderActionIcon(UserX, true);
  if (key.includes('unpublish')) return renderActionIcon(EyeOff);
  if (key.includes('publish')) return renderActionIcon(Send);
  if (key.includes('payment')) return renderActionIcon(CreditCard);
  if (key.includes('edit') || key.includes('adjust')) return renderActionIcon(Pencil);
  if (key.includes('open')) return renderActionIcon(ExternalLink);
  if (key.includes('marks')) return renderActionIcon(ClipboardPen);
  if (key.includes('convert')) return renderActionIcon(GraduationCap);
  if (key.includes('check out')) return renderActionIcon(LogOut);
  if (key.includes('renew')) return renderActionIcon(RotateCcw);
  if (key.includes('return') || key.includes('unpost')) return renderActionIcon(Undo2);
  if (key.includes('post') || key.includes('fulfill') || key.includes('approve')) {
    return renderActionIcon(CheckCircle);
  }
  if (key.includes('attendance')) return renderActionIcon(ClipboardCheck);
  if (key.includes('export') || key.includes('download')) return renderActionIcon(Download);
  if (key.includes('print')) return renderActionIcon(Printer);

  return null;
}

export function RowActionsMenu({
  items,
}: {
  items: Array<{
    label: string;
    href?: string;
    target?: string;
    onClick?: () => void;
    icon?: ReactNode;
  }>;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  const { triggerRef, menuRef, position, closeMenu } = useDropdownMenu<HTMLDivElement>({
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
          <DropdownMenuBackdrop onClose={closeMenu} />
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
                const icon = item.icon ?? getDefaultActionIcon(item.label);
                const content = (
                  <>
                    {icon}
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
                    target={item.target}
                    rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
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
