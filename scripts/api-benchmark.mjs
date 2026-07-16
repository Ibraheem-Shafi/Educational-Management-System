/**
 * API endpoint timing benchmark. Loads Supabase creds from apps/web/.env.local.
 * Usage: node scripts/api-benchmark.mjs
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const envLocal = readFileSync(resolve(root, 'apps/web/.env.local'), 'utf8');
const getEnv = (key) => {
  const m = envLocal.match(new RegExp(`${key}="([^"]+)"`));
  return m?.[1];
};

const SUPABASE_URL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const ANON_KEY = getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const API = (getEnv('NEXT_PUBLIC_API_URL') || 'http://localhost:3001') + '/api/v1';

async function login() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@nexium.edu.pk', password: 'Nexium@2026!' }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(JSON.stringify(data));
  return data.access_token;
}

async function timeEndpoint(token, path) {
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`${path} => ${res.status}`);
    await res.text();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  return {
    p50: Math.round(times[Math.floor(times.length * 0.5)]),
    p95: Math.round(times[Math.floor(times.length * 0.95)]),
  };
}

const token = await login();
const students = await fetch(`${API}/students?limit=5`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());
const batchId = students.data?.[0]?.batchId ?? '';
const branchId = students.data?.[0]?.branchId ?? '';

const paths = [
  ['/auth/me', '/auth/me'],
  ['/reports/overview', '/reports/overview'],
  ['/analytics/dashboard', '/analytics/dashboard'],
  ['/students?limit=5', '/students?limit=5'],
  ['/dashboard/summary', '/dashboard/summary'],
  [
    '/attendance/sheet',
    batchId ? `/attendance/sheet?batchId=${batchId}&date=2026-01-15&branchId=${branchId}` : null,
  ],
];

const results = { capturedAt: new Date().toISOString(), endpoints: {} };
for (const [name, path] of paths) {
  if (!path) {
    results.endpoints[name] = { skipped: true };
    continue;
  }
  try {
    results.endpoints[name] = await timeEndpoint(token, path);
  } catch (err) {
    results.endpoints[name] = { error: String(err) };
  }
}

console.log(JSON.stringify(results, null, 2));
