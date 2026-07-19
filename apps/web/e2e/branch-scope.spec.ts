import { test, expect, type Page } from '@playwright/test';
import { setupMockSuperAdminSession } from './helpers/mock-api';

const hasSupabaseEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

async function openAppScopeDropdown(page: Page) {
  const trigger = page.getByRole('button', { name: 'App branch scope' });
  await expect(trigger).toBeVisible({ timeout: 15_000 });
  await trigger.click();
  return trigger;
}

test.describe('Global branch scope (Super Admin, API-mocked)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasSupabaseEnv, 'NEXT_PUBLIC_SUPABASE_URL required for dashboard auth');
    await setupMockSuperAdminSession(page);
  });

  test('header shows app scope selector defaulting to All branches', async ({ page }) => {
    await page.goto('/dashboard/students');
    const trigger = page.getByRole('button', { name: 'App branch scope' });
    await expect(trigger).toBeVisible({ timeout: 15_000 });
    await expect(trigger).toContainText('All branches');
  });

  test('selecting one branch scopes list requests to that branch', async ({ page }) => {
    await page.goto('/dashboard/students');
    await openAppScopeDropdown(page);

    // Use branch-2: branch-1 may already be cached from the initial render,
    // in which case React Query serves it without a network request.
    const scopedRequest = page.waitForRequest(
      (req) => req.url().includes('/students?') && req.url().includes('branchId=branch-2'),
      { timeout: 15_000 },
    );
    await page.getByRole('option', { name: 'Lahore Campus' }).click();
    await scopedRequest;

    const trigger = page.getByRole('button', { name: 'App branch scope' });
    await expect(trigger).toContainText('Lahore Campus');
  });

  test('app scope persists in localStorage keyed by user id', async ({ page }) => {
    await page.goto('/dashboard/students');
    await openAppScopeDropdown(page);
    await page.getByRole('option', { name: 'Lahore Campus' }).click();

    await expect
      .poll(async () =>
        page.evaluate(() => localStorage.getItem('eims.branch-scope.v1:user-super-1')),
      )
      .toContain('branch-2');
  });

  test('page override resets on navigation', async ({ page }) => {
    await page.goto('/dashboard/students');

    const pageOverride = page.getByRole('button', { name: /page override/i }).first();
    await expect(pageOverride).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Using app selection').first()).toBeVisible();

    await pageOverride.click();
    await page.getByRole('option', { name: 'Main Campus' }).click();
    await expect(page.getByRole('button', { name: 'Reset to app selection' })).toBeVisible();

    // Navigating away and back clears the temporary page override.
    await page.goto('/dashboard/notices');
    await page.goto('/dashboard/students');
    await expect(page.getByText('Using app selection').first()).toBeVisible({ timeout: 15_000 });
  });
});
