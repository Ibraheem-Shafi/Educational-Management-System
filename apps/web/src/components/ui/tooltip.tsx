'use client';

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';

type TooltipSide = 'top' | 'bottom';

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
  contentClassName,
  disabled,
}: {
  content?: ReactNode;
  children: ReactNode;
  side?: TooltipSide;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
}) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    setCoords({
      top: side === 'top' ? rect.top - gap : rect.bottom + gap,
      left: Math.min(
        Math.max(rect.left + rect.width / 2, 12),
        window.innerWidth - 12,
      ),
    });
  }, [side]);

  const show = useCallback(() => {
    if (disabled || content == null || content === '') return;
    updatePosition();
    setOpen(true);
  }, [content, disabled, updatePosition]);

  const hide = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, updatePosition]);

  if (disabled || content == null || content === '') {
    return <>{children}</>;
  }

  return (
    <>
      <span
        ref={triggerRef}
        className={cn('inline-flex max-w-full min-w-0', className)}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </span>
      {mounted &&
        open &&
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            style={{
              top: coords.top,
              left: coords.left,
              transform:
                side === 'top' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)',
            }}
            className={cn(
              'pointer-events-none fixed z-[100] max-w-[min(90vw,20rem)] whitespace-nowrap',
              'rounded-lg border border-[var(--stroke-soft-200,#E2E4E9)] bg-[var(--neutral-0,#ffffff)]',
              'px-2.5 py-1.5 text-xs font-medium leading-4 text-[var(--text-main-900,#0A0D14)]',
              'shadow-[0_4px_16px_rgba(10,13,20,0.08)]',
              contentClassName,
            )}
          >
            {content}
          </span>,
          document.body,
        )}
    </>
  );
}
