import { test, expect } from '@playwright/test';
import { createAssumption, createWorkspaceFromStart } from './helpers';

/**
 * Helper function to ensure a workspace is created in a tab
 * Handles both the new Start screen and legacy behaviors
 */
async function ensureWorkspaceInTab(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1000);

  const url = page.url();
  if (!url.includes('#doc=')) {
    // Try to create workspace from Start screen (new behavior)
    const created = await createWorkspaceFromStart(page);
    if (!created) {
      // Fallback to old hamburger menu approach
      const hamburgerButton = page.locator(
        '.dropdown-top .btn[role="button"]'
      );
      if (await hamburgerButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await hamburgerButton.click();
        await page.waitForTimeout(300);
        const newBoardButton = page.getByText('New Board', { exact: true });
        if (await newBoardButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await newBoardButton.click();
          await page.waitForURL(/.*#doc=.*/);
          await page.waitForTimeout(500);
        }
      }
    }
  }

  // Wait for workspace to be ready
  const newAssumptionButton = page.getByRole('button', { name: /new assumption/i }).first();
  await expect(newAssumptionButton).toBeVisible({ timeout: 15000 });
}

/**
 * E2E Tests for multi-tab collaboration
 * Uses BroadcastChannel for instant sync between tabs in the same browser context
 */
test.describe('Multi-Tab Collaboration', () => {
  test('should sync new assumption between two tabs via BroadcastChannel', async ({
    context,
  }) => {
    // Create two pages in the SAME context (shares BroadcastChannel)
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Tab 1: Create a new board
      await ensureWorkspaceInTab(page1);

      // Get the document URL
      const docUrl = page1.url();

      // Tab 2: Open the same document
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(1000); // Wait for BroadcastChannel connection

      // Wait for Tab 2 to be ready (may need to confirm join)
      // Check for join dialog and confirm if present
      const joinButton = page2.getByRole('button', { name: /beitreten/i });
      if (await joinButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await joinButton.click();
        await page2.waitForTimeout(500);
      }

      // Wait for Tab 2 to show the workspace content
      await expect(page2.getByRole('button', { name: /new assumption/i }).first()).toBeVisible({ timeout: 10000 });

      // Tab 1: Create an assumption
      const assumptionText = 'This should sync to tab 2 via BroadcastChannel';
      await createAssumption(page1, assumptionText);

      // BroadcastChannel sync is instant - short wait is enough
      await page2.waitForTimeout(500);

      // Verify it appears in Tab 2
      await expect(page2.getByText(assumptionText)).toBeVisible({
        timeout: 5000,
      });
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('should show assumptions created from both tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Tab 1: Create board
      await ensureWorkspaceInTab(page1);

      await createAssumption(page1, 'Assumption from tab 1');

      // Get URL and open in Tab 2
      const docUrl = page1.url();
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(1000);

      // Handle join dialog if present
      const joinButton = page2.getByRole('button', { name: /beitreten/i });
      if (await joinButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await joinButton.click();
        await page2.waitForTimeout(500);
      }

      // Wait for workspace to be ready
      await expect(page2.getByRole('button', { name: /new assumption/i }).first()).toBeVisible({ timeout: 10000 });

      // Tab 2: Should see tab 1's assumption
      await expect(page2.getByText('Assumption from tab 1')).toBeVisible({
        timeout: 5000,
      });

      // Tab 2: Create own assumption
      await createAssumption(page2, 'Assumption from tab 2');

      // Wait for sync back to Tab 1
      await page1.waitForTimeout(500);

      // Tab 1: Should now see both
      await expect(page1.getByText('Assumption from tab 1')).toBeVisible();
      await expect(page1.getByText('Assumption from tab 2')).toBeVisible({
        timeout: 5000,
      });
    } finally {
      await page1.close();
      await page2.close();
    }
  });

  test('should handle concurrent assumption creation', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    try {
      // Setup: Create board
      await ensureWorkspaceInTab(page1);

      const docUrl = page1.url();
      await page2.goto(docUrl);
      await page2.waitForLoadState('networkidle');
      await page2.waitForTimeout(1000);

      // Handle join dialog if present
      const joinButton = page2.getByRole('button', { name: /beitreten/i });
      if (await joinButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await joinButton.click();
        await page2.waitForTimeout(500);
      }

      // Wait for workspace to be ready in Tab 2
      await expect(page2.getByRole('button', { name: /new assumption/i }).first()).toBeVisible({ timeout: 10000 });

      // Both tabs create assumptions at roughly the same time
      await Promise.all([
        createAssumption(page1, 'Concurrent assumption 1'),
        createAssumption(page2, 'Concurrent assumption 2'),
      ]);

      // Wait for sync
      await page1.waitForTimeout(1000);
      await page2.waitForTimeout(1000);

      // Both assumptions should be preserved (CRDT merge)
      // Check both tabs show both assumptions
      await expect(page1.getByText('Concurrent assumption 1')).toBeVisible({
        timeout: 5000,
      });
      await expect(page1.getByText('Concurrent assumption 2')).toBeVisible({
        timeout: 5000,
      });

      await expect(page2.getByText('Concurrent assumption 1')).toBeVisible({
        timeout: 5000,
      });
      await expect(page2.getByText('Concurrent assumption 2')).toBeVisible({
        timeout: 5000,
      });
    } finally {
      await page1.close();
      await page2.close();
    }
  });
});
