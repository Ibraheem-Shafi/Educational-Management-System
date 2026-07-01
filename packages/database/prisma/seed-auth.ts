import { PrismaClient } from '@prisma/client';
import { loadDemoConfig } from './seed-demo/load-demo-config';

const DEFAULT_PASSWORD = 'Rekhta@2026!';

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 12_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function primaryRole(roles: string[]): string | null {
  if (roles.includes('super_admin')) return 'super_admin';
  if (roles.includes('branch_admin')) return 'branch_admin';
  return roles[0] ?? null;
}

async function findSupabaseUserId(
  base: string,
  headers: Record<string, string>,
  email: string,
): Promise<string | null> {
  const filter = encodeURIComponent(`email.eq.${email}`);
  const listRes = await fetchWithTimeout(
    `${base}/auth/v1/admin/users?filter=${filter}&per_page=1`,
    { headers },
  );
  if (listRes.ok) {
    const body = (await listRes.json()) as { users?: Array<{ id: string; email?: string }> };
    if (body.users?.[0]?.id) return body.users[0].id;
  }

  const pageRes = await fetchWithTimeout(`${base}/auth/v1/admin/users?page=1&per_page=200`, {
    headers,
  });
  if (pageRes.ok) {
    const body = (await pageRes.json()) as { users?: Array<{ id: string; email?: string }> };
    const match = body.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match?.id) return match.id;
  }
  return null;
}

async function createSupabaseUser(
  base: string,
  headers: Record<string, string>,
  email: string,
  password: string,
  fullName: string,
): Promise<{ id: string | null; error?: string }> {
  const existing = await findSupabaseUserId(base, headers, email);
  if (existing) return { id: existing };

  const createRes = await fetchWithTimeout(`${base}/auth/v1/admin/users`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    }),
  });
  if (createRes.ok) {
    const created = (await createRes.json()) as { id: string };
    return { id: created.id };
  }

  const errBody = await createRes.text();
  if (createRes.status === 422 || createRes.status === 409) {
    const found = await findSupabaseUserId(base, headers, email);
    if (found) return { id: found };
  }

  return { id: null, error: `${createRes.status} ${errBody.slice(0, 200)}` };
}

async function syncAppMetadata(
  base: string,
  headers: Record<string, string>,
  supabaseUserId: string,
  role: string | null,
  branchId: string | null,
): Promise<boolean> {
  const res = await fetchWithTimeout(`${base}/auth/v1/admin/users/${supabaseUserId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      app_metadata: {
        role,
        branch_id: branchId,
      },
    }),
  });
  return res.ok;
}

export async function runDemoAuthSync(prisma: PrismaClient, password = DEFAULT_PASSWORD): Promise<void> {
  const base = process.env.SUPABASE_URL?.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for auth sync.');
    process.exit(1);
  }

  const headers: Record<string, string> = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
  };

  const config = loadDemoConfig();
  console.log(`Syncing ${config.accounts.length} demo accounts to Supabase Auth…`);

  const results: Array<{ email: string; role: string; status: string }> = [];

  for (const account of config.accounts) {
    const dbUser = await prisma.user.findFirst({
      where: { email: account.email, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });

    if (!dbUser) {
      results.push({ email: account.email, role: account.role, status: 'SKIP (not in DB)' });
      continue;
    }

    let supabaseUserId: string | null = null;
    const created = await createSupabaseUser(
      base,
      headers,
      account.email,
      password,
      account.fullName,
    );
    supabaseUserId = created.id;

    if (!supabaseUserId) {
      results.push({
        email: account.email,
        role: account.role,
        status: `FAILED${created.error ? `: ${created.error}` : ''}`,
      });
      continue;
    }

    if (dbUser.supabaseUserId !== supabaseUserId) {
      await prisma.user.update({
        where: { id: dbUser.id },
        data: { supabaseUserId },
      });
    }

    const roles = dbUser.userRoles.map((ur) => ur.role.code);
    const role = primaryRole(roles.length ? roles : [account.role]);
    const branchId = dbUser.branchId;

    const metaOk = await syncAppMetadata(base, headers, supabaseUserId, role, branchId);
    results.push({
      email: account.email,
      role: account.role,
      status: metaOk ? 'OK' : 'OK (metadata failed)',
    });
  }

  console.log('');
  console.log('Email                          | Role           | Status');
  console.log('-------------------------------|----------------|------------------');
  for (const r of results) {
    console.log(`${r.email.padEnd(30)} | ${r.role.padEnd(14)} | ${r.status}`);
  }
  console.log('');
  console.log(`Demo password: ${password}`);
}

const prisma = new PrismaClient();

const password =
  process.env.DEMO_SEED_PASSWORD ??
  (() => {
    try {
      const fs = require('fs');
      const path = require('path');
      const inst = JSON.parse(
        fs.readFileSync(
          path.resolve(__dirname, '../../../docs/templates/rekhta.institution.json'),
          'utf-8',
        ),
      );
      return inst.demo?.password ?? DEFAULT_PASSWORD;
    } catch {
      return DEFAULT_PASSWORD;
    }
  })();

runDemoAuthSync(prisma, password)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
