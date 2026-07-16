'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

const STORAGE_KEY = 'sidebar-collapsed';

interface SidebarContextValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** When true, sidebar always renders expanded (e.g. mobile sheet). */
  forceExpanded: boolean;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggleCollapsed: () => {},
  forceExpanded: false,
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') setCollapsed(true);
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      collapsed: hydrated ? collapsed : false,
      toggleCollapsed,
      forceExpanded: false,
    }),
    [collapsed, hydrated, toggleCollapsed],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  return useContext(SidebarContext);
}

/** Wraps SidebarNav in mobile sheet — always expanded, collapse disabled. */
export function SidebarExpandedProvider({ children }: { children: ReactNode }) {
  const parent = useContext(SidebarContext);
  const value = useMemo(
    () => ({
      collapsed: false,
      toggleCollapsed: parent.toggleCollapsed,
      forceExpanded: true,
    }),
    [parent.toggleCollapsed],
  );
  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}
