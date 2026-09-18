const STORAGE_PREFIX = 'eims-fee-invoice-print:';
const TTL_MS = 30 * 60 * 1000;

export function openBulkInvoicePrint(ids: string[]) {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return;
  if (unique.length === 1) {
    window.open(`/print/fee-invoices/${unique[0]}`, '_blank');
    return;
  }
  const batch = crypto.randomUUID();
  localStorage.setItem(
    `${STORAGE_PREFIX}${batch}`,
    JSON.stringify({ ids: unique, expiresAt: Date.now() + TTL_MS }),
  );
  window.open(`/print/fee-invoices/bulk?batch=${encodeURIComponent(batch)}`, '_blank');
}

export function readBulkInvoicePrintIds(batch: string): string[] {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${batch}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { ids?: unknown; expiresAt?: number };
    if (typeof parsed.expiresAt === 'number' && parsed.expiresAt < Date.now()) {
      localStorage.removeItem(`${STORAGE_PREFIX}${batch}`);
      return [];
    }
    return Array.isArray(parsed.ids)
      ? parsed.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : [];
  } catch {
    return [];
  }
}
