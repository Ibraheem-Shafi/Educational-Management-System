import { test, expect } from '@playwright/test';

test.describe('Accept invitation', () => {
  test('completes invite form with mocked API', async ({ page }) => {
    const token = 'test-invite-token';

    await page.route('**/api/v1/settings/institution', async (route) => {
      return route.fulfill({
        json: { name: 'Test Institution', primaryColor: '#2563eb', terminology: {}, featureFlags: {} },
      });
    });

    await page.route('**/api/v1/auth/invitations/accept', async (route) => {
      if (route.request().method() === 'POST') {
        return route.fulfill({ status: 201, json: { success: true } });
      }
      return route.continue();
    });

    await page.route(`**/api/v1/auth/invitations/${token}`, async (route) => {
      if (route.request().method() === 'GET') {
        return route.fulfill({
          json: { email: 'newuser@test.pk', role: { name: 'Teacher' }, expiresAt: new Date().toISOString() },
        });
      }
      return route.continue();
    });

    await page.goto(`/accept-invite?token=${token}`);
    await expect(page.getByText('newuser@test.pk')).toBeVisible();

    await page.locator('form input').first().fill('New User');
    await page.locator('input[type="password"]').fill('SecurePass1');
    await page.getByRole('button', { name: 'Activate account' }).click();

    await expect(page.getByText(/account created/i)).toBeVisible({ timeout: 10_000 });
  });
});
