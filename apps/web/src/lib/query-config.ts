/** Shared React Query cache timings — safe for server and client imports. */

export const REFERENCE_STALE_MS = 5 * 60 * 1000;
export const LIST_STALE_MS = 30 * 1000;

export const defaultQueryOptions = {
  staleTime: LIST_STALE_MS,
  refetchOnWindowFocus: false,
  retry: 1,
} as const;

/** Apply longer staleTime for reference-data query keys. */
export function referenceQueryOptions() {
  return { staleTime: REFERENCE_STALE_MS };
}
