'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

const MENU_GAP = 4;
const DEFAULT_MAX_HEIGHT = 240;
const MENU_Z_INDEX = 100000;
const BACKDROP_Z_INDEX = 99999;
const CLICK_SHIELD_MS = 400;
const CLICK_SHIELD_ID = 'dropdown-click-shield';
const LEGACY_PORTAL_ID = 'dropdown-portal-root';
const MIN_MENU_HEIGHT = 96;

function removeLegacyDropdownPortal() {
  if (typeof document === 'undefined') return;
  document.getElementById(LEGACY_PORTAL_ID)?.remove();
}

if (typeof document !== 'undefined') {
  removeLegacyDropdownPortal();
}

function mountImmediateClickShield() {
  if (typeof document === 'undefined') return;

  let shield = document.getElementById(CLICK_SHIELD_ID);
  if (!shield) {
    shield = document.createElement('div');
    shield.id = CLICK_SHIELD_ID;
    shield.setAttribute('aria-hidden', 'true');
    shield.setAttribute('data-dropdown-layer', '');
    document.body.appendChild(shield);
  }

  const absorb = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  shield.style.cssText = `position:fixed;inset:0;z-index:${MENU_Z_INDEX + 1};`;
  shield.onpointerdown = absorb;
  shield.onpointerup = absorb;
  shield.onclick = absorb;

  window.setTimeout(() => {
    shield!.style.cssText = 'display:none;';
    shield!.onpointerdown = null;
    shield!.onpointerup = null;
    shield!.onclick = null;
  }, CLICK_SHIELD_MS);
}

export interface DropdownMenuPosition {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  minWidth?: number;
  /** Constrained to remaining viewport space so the menu never spills off-screen. */
  maxHeight: number;
  placement: 'top' | 'bottom';
}

export function computeDropdownPosition(
  triggerRect: DOMRect,
  options?: {
    maxHeight?: number;
    gap?: number;
    minWidth?: number;
    align?: 'left' | 'right' | 'match';
    /** Measured menu height when known; falls back to maxHeight for the flip check. */
    contentHeight?: number;
  },
): DropdownMenuPosition {
  const maxHeight = options?.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const gap = options?.gap ?? MENU_GAP;
  const minWidth = options?.minWidth;
  const align = options?.align ?? 'match';
  const contentHeight = options?.contentHeight;

  const width =
    align === 'match' ? triggerRect.width : Math.max(minWidth ?? triggerRect.width, triggerRect.width);
  const left = align === 'right' ? triggerRect.right - width : triggerRect.left;

  const spaceBelow = window.innerHeight - triggerRect.bottom - gap;
  const spaceAbove = triggerRect.top - gap;
  // Open upward when the menu won't fit below and there is more room above.
  const needed = Math.min(maxHeight, contentHeight ?? maxHeight);
  const openUp = spaceBelow < needed && spaceAbove > spaceBelow;

  const available = Math.max(0, openUp ? spaceAbove : spaceBelow);
  const constrainedMaxHeight = Math.max(
    MIN_MENU_HEIGHT,
    Math.min(maxHeight, available > 0 ? available : maxHeight),
  );

  if (openUp) {
    return {
      bottom: window.innerHeight - triggerRect.top + gap,
      left,
      width: align === 'match' ? triggerRect.width : width,
      minWidth,
      maxHeight: constrainedMaxHeight,
      placement: 'top',
    };
  }

  return {
    top: triggerRect.bottom + gap,
    left,
    width: align === 'match' ? triggerRect.width : width,
    minWidth,
    maxHeight: constrainedMaxHeight,
    placement: 'bottom',
  };
}

export function useDropdownMenu<TMenu extends HTMLElement = HTMLElement>({
  open,
  onClose,
  maxHeight = DEFAULT_MAX_HEIGHT,
  align = 'match',
  minWidth,
}: {
  open: boolean;
  onClose: () => void;
  maxHeight?: number;
  align?: 'left' | 'right' | 'match';
  minWidth?: number;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<TMenu>(null);
  const [position, setPosition] = useState<DropdownMenuPosition | null>(null);
  const [clickShield, setClickShield] = useState(false);

  const closeMenu = useCallback(() => {
    mountImmediateClickShield();
    onClose();
    setClickShield(true);
    window.setTimeout(() => setClickShield(false), CLICK_SHIELD_MS);
  }, [onClose]);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition(
      computeDropdownPosition(rect, {
        maxHeight,
        align,
        minWidth,
        contentHeight: menuRef.current?.scrollHeight,
      }),
    );
  }, [align, maxHeight, minWidth]);

  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    updatePosition();
    // Remeasure after the portal menu paints so short lists don't wrongly flip,
    // and tall lists flip/clamp against real height.
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(updatePosition);
    });

    const onScroll = (event: Event) => {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      updatePosition();
    };

    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu();
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, closeMenu]);

  return {
    triggerRef,
    menuRef,
    position,
    closeMenu,
    clickShield,
  };
}

export function getDropdownPortalRoot(): HTMLElement {
  return document.body;
}

export function dropdownMenuStyle(position: DropdownMenuPosition): CSSProperties {
  return {
    position: 'fixed',
    top: position.top,
    bottom: position.bottom,
    left: position.left,
    width: position.width,
    minWidth: position.minWidth,
    maxHeight: position.maxHeight,
    zIndex: MENU_Z_INDEX,
  };
}

export function dropdownBackdropStyle(): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    zIndex: BACKDROP_Z_INDEX,
  };
}

export function dropdownClickShieldStyle(): CSSProperties {
  return {
    position: 'fixed',
    inset: 0,
    zIndex: MENU_Z_INDEX + 1,
  };
}

function absorbPointerEvent(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

/** Blocks stray clicks after the menu unmounts. */
export function DropdownClickShield({ active }: { active: boolean }) {
  if (!active || typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-hidden
      data-dropdown-layer
      style={dropdownClickShieldStyle()}
      onPointerDown={absorbPointerEvent}
      onPointerUp={absorbPointerEvent}
      onClick={absorbPointerEvent}
    />,
    document.body,
  );
}

/** Transparent layer that captures outside clicks while the menu is open. */
export function DropdownMenuBackdrop({ onClose }: { onClose: () => void }) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      aria-hidden
      data-dropdown-layer
      style={dropdownBackdropStyle()}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
    />,
    document.body,
  );
}

export function DropdownMenuPortal({ children }: { children: ReactNode }) {
  if (typeof document === 'undefined') return null;
  return createPortal(children, document.body);
}

/** Select an option and close without passing the click through. */
export function handleDropdownOptionSelect(
  event: React.MouseEvent | React.PointerEvent,
  onSelect: () => void,
) {
  event.preventDefault();
  event.stopPropagation();
  onSelect();
}
