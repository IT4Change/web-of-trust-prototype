import { test, expect } from '@playwright/test';
import {
  createAssumption,
  ensureOnBoard,
  createNewBoard,
  createWorkspaceFromStart,
} from './helpers';

/**
 * E2E Tests for URL-based document sharing
 * Validates that documents can be shared via URL and persist across sessions
 */
test.describe('URL Sharing', () => {
  test('should create document with URL parameter', async ({ page }) => {
    await ensureOnBoard(page);

    // URL should contain ?doc= with a valid document ID (query param for link preview compatibility)
    const url = page.url();
    // Accept both query param (new) and hash (backwards compat)
    const hasDoc = url.includes('?doc=') || url.includes('&doc=') || url.includes('#doc=');
    expect(hasDoc).toBe(true);
    expect(url).toMatch(/[?&#]doc=[A-Za-z0-9]+/);
  });

  test('should maintain document ID in URL when adding content', async ({
    page,
  }) => {
    await ensureOnBoard(page);

    const initialUrl = page.url();
    // Extract doc ID from query param or hash
    const urlObj = new URL(initialUrl);
    const docId = urlObj.searchParams.get('doc') || urlObj.hash.match(/doc=([^&]+)/)?.[1];

    // Add content
    await createAssumption(page, 'Testing URL persistence');
    await page.waitForTimeout(500);

    // URL should still have the same document ID
    const currentUrl = page.url();
    expect(currentUrl).toContain(docId);
  });

  test('should persist document after page reload', async ({ page }) => {
    await ensureOnBoard(page);

    const assumptionText = 'Persistence test assumption';
    await createAssumption(page, assumptionText);

    // Get current URL
    const docUrl = page.url();

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Wait for sync

    // Content should still be there
    await expect(page.getByText(assumptionText)).toBeVisible({ timeout: 10000 });
  });

  test('should support multiple documents', async ({ page }) => {
    // Create first document
    await ensureOnBoard(page);
    await createAssumption(page, 'First document assumption');
    const firstDocUrl = page.url();

    // Create second document via workspace switcher
    await createNewBoard(page);

    const secondDocUrl = page.url();

    // Document URLs should be different
    expect(firstDocUrl).not.toBe(secondDocUrl);

    // Create assumption in second document
    await createAssumption(page, 'Second document assumption');

    // Navigate back to first document via workspace switcher or URL
    await page.goto(firstDocUrl);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Handle join dialog if present (when returning to a workspace)
    const joinButton = page.getByRole('button', { name: /beitreten/i });
    if (await joinButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await joinButton.click();
      await page.waitForTimeout(500);
    }

    // Wait for workspace to be ready
    await expect(page.getByRole('button', { name: /new assumption/i }).first()).toBeVisible({ timeout: 10000 });

    // Should see first document content
    await expect(page.getByText('First document assumption')).toBeVisible({
      timeout: 10000,
    });

    // Should NOT see second document content
    await expect(page.getByText('Second document assumption')).not.toBeVisible();
  });

  test('should share document URL between tabs', async ({ context }) => {
    // Use same context for BroadcastChannel sync
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Page 1: Create a document
      await page1.goto('/');
      await page1.waitForLoadState('networkidle');
      await page1.waitForTimeout(1000);

      // Ensure we have a document (check query param or hash)
      const url1 = page1.url();
      const hasDoc = url1.includes('?doc=') || url1.includes('&doc=') || url1.includes('#doc=');
      if (!hasDoc) {
        // Try Start screen first (new behavior)
        const created = await createWorkspaceFromStart(page1);
        if (!created) {
          // Fallback to workspace switcher
          await createNewBoard(page1);
        }
      }

      // Wait for workspace to be ready
      await expect(page1.getByRole('button', { name: /new assumption/i }).first()).toBeVisible({ timeout: 15000 });

      await createAssumption(page1, 'Shared document test');
      const shareUrl = page1.url();

      // Page 2: Open the same URL
      await page2.goto(shareUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(1000); // Wait for BroadcastChannel sync

      // Handle join dialog if present
      const joinButton = page2.getByRole('button', { name: /beitreten/i });
      if (await joinButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await joinButton.click();
        await page2.waitForTimeout(500);
      }

      // Wait for workspace to be ready in page2
      await expect(page2.getByRole('button', { name: /new assumption/i }).first()).toBeVisible({ timeout: 10000 });

      // Should see the same content
      await expect(page2.getByText('Shared document test')).toBeVisible({
        timeout: 5000,
      });

      // Verify URL is the same
      expect(page2.url()).toBe(shareUrl);
    } finally {
      await page1.close();
      await page2.close();
    }
  });
});
