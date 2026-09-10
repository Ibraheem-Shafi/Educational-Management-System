const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function configuredOrigins(env: NodeJS.ProcessEnv): string[] {
  return [env.NEXT_PUBLIC_APP_URL, env.WEB_URL]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.replace(/\/$/, ''));
}

function isPrivateIpv4(hostname: string): boolean {
  if (/^10(?:\.\d{1,3}){3}$/.test(hostname)) return true;
  if (/^192\.168(?:\.\d{1,3}){2}$/.test(hostname)) return true;
  return /^172\.(1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2}$/.test(hostname);
}

/**
 * Browser Origin allow-list for Nest CORS.
 * Production stays locked to configured app URLs. Local/dev also accepts
 * loopback and RFC1918 hosts so Next.js "Network" URLs work on a new machine.
 */
export function isAllowedCorsOrigin(
  origin: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!origin) return true;

  const normalized = origin.replace(/\/$/, '');
  if (configuredOrigins(env).includes(normalized)) return true;
  if ((env.NODE_ENV ?? 'development') === 'production') return false;

  try {
    const { hostname } = new URL(origin);
    return LOOPBACK_HOSTS.has(hostname) || isPrivateIpv4(hostname);
  } catch {
    return false;
  }
}
