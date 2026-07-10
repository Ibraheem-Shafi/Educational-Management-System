'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ParentChildData } from '@/lib/portal-types';

const CHILD_PARAM = 'childId';
const LEGACY_CHILD_PARAM = 'studentId';

function readChildIdFromParams(searchParams: URLSearchParams): string {
  return searchParams.get(CHILD_PARAM) ?? searchParams.get(LEGACY_CHILD_PARAM) ?? '';
}

/**
 * Resolves and persists the active child for parent portal routes via URL search params.
 */
export function usePortalChildId(children: ParentChildData[]) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [childId, setChildIdState] = useState(() => readChildIdFromParams(searchParams));

  useEffect(() => {
    const fromUrl = readChildIdFromParams(searchParams);
    if (fromUrl) {
      setChildIdState(fromUrl);
      return;
    }
    if (children.length > 0) {
      setChildIdState(children[0].student.id);
    }
  }, [children, searchParams]);

  const selectedChild = useMemo(
    () => children.find((c) => c.student.id === childId),
    [children, childId],
  );

  const setChildId = useCallback(
    (nextId: string) => {
      setChildIdState(nextId);
      const params = new URLSearchParams(searchParams.toString());
      if (nextId) {
        params.set(CHILD_PARAM, nextId);
        params.delete(LEGACY_CHILD_PARAM);
      } else {
        params.delete(CHILD_PARAM);
        params.delete(LEGACY_CHILD_PARAM);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    },
    [pathname, router, searchParams],
  );

  const childHref = useCallback(
    (basePath: string, id?: string) => {
      const targetId = id ?? childId;
      if (!targetId) return basePath;
      return `${basePath}?${CHILD_PARAM}=${encodeURIComponent(targetId)}`;
    },
    [childId],
  );

  return { childId, setChildId, selectedChild, childHref };
}
