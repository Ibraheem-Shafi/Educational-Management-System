export function getJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const segment = token.split('.')[1];
    if (!segment) return null;
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function getJwtAlg(token: string): string | null {
  try {
    const segment = token.split('.')[0];
    if (!segment) return null;
    const padded = segment.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    const header = JSON.parse(json) as { alg?: unknown };
    return typeof header.alg === 'string' ? header.alg : null;
  } catch {
    return null;
  }
}

export function getJwtAal(token: string): string | null {
  const payload = getJwtPayload(token);
  const aal = payload?.aal;
  return typeof aal === 'string' ? aal : null;
}
