/**
 * Period-over-period percent change.
 * Returns null when there is no meaningful baseline (previous === 0),
 * so the UI can hide the badge instead of inventing +100%.
 */
export function computeChangePercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
