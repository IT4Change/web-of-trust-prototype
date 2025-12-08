import { test, expect } from '@playwright/test';
import { createAssumption, ensureOnBoard } from './helpers';

/**
 * E2E Tests for basic assumption creation and management
 */
test.describe('Assumption Flow', () => {
  test.beforeEach(async ({ page }) => {
    await ensureOnBoard(page);
  });

  test('should create a new assumption', async ({ page }) => {
    const assumptionText = 'E2E testing is essential for quality software';
    await createAssumption(page, assumptionText);

    // Verify the assumption appears in the list
    await expect(page.getByText(assumptionText)).toBeVisible({ timeout: 10000 });
  });

  test('should create assumption with tags', async ({ page }) => {
    const assumptionText = 'TypeScript improves code quality';
    await createAssumption(page, assumptionText, 'Testing, Quality');

    // Verify assumption appears
    await expect(page.getByText(assumptionText)).toBeVisible({ timeout: 10000 });

    // Verify tags appear (they might be badges or chips)
    await expect(page.getByText(/testing/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('should show empty state when no assumptions exist', async ({ page }) => {
    // On a fresh board, should show empty state (German: "Erstelle deine erste Annahme")
    const emptyMessage = page.getByText(/erste Annahme|no assumptions yet/i);

    // Either empty state is visible OR we already have assumptions
    const hasAssumptions = await page.locator('[data-testid="assumption-card"]').count() > 0;
    if (!hasAssumptions) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test('should persist assumptions after page reload', async ({ page }) => {
    const assumptionText = 'This should persist after reload';
    await createAssumption(page, assumptionText);

    // Wait for assumption to appear
    await expect(page.getByText(assumptionText)).toBeVisible({ timeout: 10000 });

    // Get the current URL (contains document ID)
    const currentUrl = page.url();

    // Reload the page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for sync

    // Verify we're on the same document
    expect(page.url()).toBe(currentUrl);

    // Verify assumption still exists
    await expect(page.getByText(assumptionText)).toBeVisible({ timeout: 10000 });
  });

  test('should display multiple assumptions', async ({ page }) => {
    // Create multiple assumptions
    await createAssumption(page, 'First assumption');
    await page.waitForTimeout(500);
    await createAssumption(page, 'Second assumption');
    await page.waitForTimeout(500);
    await createAssumption(page, 'Third assumption');

    // Verify all appear
    await expect(page.getByText('First assumption')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Second assumption')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Third assumption')).toBeVisible({ timeout: 10000 });
  });
});
