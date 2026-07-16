import { test, expect } from '@playwright/test';
import { setupMockStaffSession } from './helpers/mock-api';

const hasSupabaseEnv = !!process.env.NEXT_PUBLIC_SUPABASE_URL;

test.describe('Critical paths (API-mocked)', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page }) => {
    test.skip(!hasSupabaseEnv, 'NEXT_PUBLIC_SUPABASE_URL required for dashboard auth');
    await setupMockStaffSession(page);
  });

  test('users page shows invite form', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page.getByRole('button', { name: 'Invite User' })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole('button', { name: 'Invite User' }).click();
    await expect(page.getByRole('heading', { name: 'Invite User' })).toBeVisible();
    await expect(page.getByPlaceholder('e.g., info@nexium.edu.pk')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Invite' })).toBeVisible();
  });

  test('admit student page shows admission form', async ({ page }) => {
    await page.goto('/dashboard/students/new');
    await expect(page.getByRole('heading', { name: 'Admit Student' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Admit student' })).toBeVisible();
    await expect(page.locator('select').filter({ hasText: 'Select status' })).toBeVisible();
  });

  test('attendance page shows monthly grid', async ({ page }) => {
    await page.goto('/dashboard/attendance');
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('View and manage all attendance records')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Student' })).toBeVisible();
    await expect(page.getByText('Ali Khan')).toBeVisible({ timeout: 10_000 });
  });

  test('fees page shows new invoice form', async ({ page }) => {
    await page.goto('/dashboard/fees');
    await expect(page.getByRole('button', { name: 'New invoice' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'New invoice' }).click();
    await expect(page.getByRole('heading', { name: 'Create invoice' })).toBeVisible();
    await expect(page.getByPlaceholder('Amount (PKR)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create invoice' })).toBeVisible();
  });

  test('reports page shows overview and export', async ({ page }) => {
    await page.goto('/dashboard/reports');
    await expect(page.getByRole('heading', { name: 'Reports' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText('Overview, fee collection, and performance insights'),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Collection summary')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: 'Export CSV' }).first()).toBeVisible();
  });
});
