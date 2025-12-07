import { Page, expect } from '@playwright/test';

/**
 * Helper functions for E2E tests
 */

/**
 * Creates a new assumption via the UI
 * @param page Playwright page object
 * @param sentence The assumption text
 * @param tags Optional comma-separated tags
 */
export async function createAssumption(
  page: Page,
  sentence: string,
  tags?: string
) {
  // Click the "New Assumption" button (use first() since there might be multiple)
  const newButton = page.getByRole('button', { name: /new assumption/i }).first();
  await expect(newButton).toBeVisible({ timeout: 10000 });
  await newButton.click();

  // Wait for modal to open and be visible
  await page.waitForTimeout(500);

  // Fill in the sentence
  const sentenceInput = page.getByPlaceholder(
    /enter a single-sentence assumption/i
  );
  await expect(sentenceInput).toBeVisible({ timeout: 5000 });
  await sentenceInput.fill(sentence);

  // Fill in tags if provided
  if (tags) {
    const tagsInput = page.getByPlaceholder(/climate, policy, energy/i);
    await tagsInput.fill(tags);
  }

  // Submit the form
  const createButton = page.getByRole('button', { name: /^create$/i });
  await expect(createButton).toBeEnabled({ timeout: 5000 });
  await createButton.click();

  // Wait for modal to close and assumption to appear in the list
  await page.waitForTimeout(1000);

  // Verify assumption was created
  await expect(page.getByText(sentence)).toBeVisible({ timeout: 10000 });
}

/**
 * Opens the workspace switcher dropdown in the header
 */
export async function openWorkspaceSwitcher(page: Page) {
  // The workspace switcher is a dropdown with role="button"
  // It's the first dropdown in the navbar
  const dropdownTrigger = page.locator('.dropdown [role="button"]').first();

  if (
    await dropdownTrigger.isVisible({ timeout: 3000 }).catch(() => false)
  ) {
    await dropdownTrigger.click();
    await page.waitForTimeout(300);
    return true;
  }

  return false;
}

/**
 * Creates a new board/workspace via the workspace switcher
 */
export async function createNewBoard(page: Page) {
  // Open workspace switcher
  const opened = await openWorkspaceSwitcher(page);
  if (!opened) {
    throw new Error('Could not open workspace switcher');
  }

  // Click on "Neuer Workspace" - use the listitem containing it
  const newWorkspaceItem = page
    .getByRole('listitem')
    .filter({ hasText: 'Neuer Workspace' });
  await expect(newWorkspaceItem).toBeVisible({ timeout: 2000 });
  await newWorkspaceItem.click();

  // Wait for modal to appear and fill in workspace name
  // Placeholder is "z.B. Mein Projekt" (German)
  const nameInput = page.getByPlaceholder(/mein projekt|workspace name/i);
  await expect(nameInput).toBeVisible({ timeout: 3000 });
  const newWorkspaceName = `Test Board ${Date.now()}`;
  await nameInput.fill(newWorkspaceName);

  // Click "Erstellen" button
  const createBtn = page.getByRole('button', { name: /erstellen/i });
  await expect(createBtn).toBeEnabled({ timeout: 2000 });
  await createBtn.click();

  // Wait for modal to close
  await expect(nameInput).not.toBeVisible({ timeout: 5000 });

  // Wait for workspace name to appear in header (indicating switch completed)
  await expect(page.getByText(newWorkspaceName).first()).toBeVisible({
    timeout: 10000,
  });

  // Wait a bit more for content to fully load
  await page.waitForTimeout(500);
}

/**
 * Creates a new workspace via the Start screen
 * Used when the app shows the Start content (no workspace loaded)
 */
export async function createWorkspaceFromStart(page: Page) {
  // Look for the "Neuen Workspace erstellen" button on the Start screen
  const createButton = page.getByRole('button', { name: /neuen workspace erstellen/i });

  if (await createButton.isVisible({ timeout: 3000 }).catch(() => false)) {
    await createButton.click();

    // Wait for the input form to appear
    // The placeholder is "Name des Workspace (optional)" for StartContent
    // or "z.B. Mein Projekt" for NewWorkspaceModal
    const nameInput = page.getByPlaceholder(/name des workspace|mein projekt|workspace name/i);
    await expect(nameInput).toBeVisible({ timeout: 3000 });

    const newWorkspaceName = `Test Board ${Date.now()}`;
    await nameInput.fill(newWorkspaceName);

    // Click "Erstellen" button
    const submitBtn = page.getByRole('button', { name: /erstellen/i });
    await expect(submitBtn).toBeEnabled({ timeout: 2000 });
    await submitBtn.click();

    // Wait for URL to contain doc ID
    await page.waitForURL(/.*#doc=.*/, { timeout: 10000 });

    // Wait for workspace content to fully load
    await page.waitForTimeout(500);
    return true;
  }

  return false;
}

/**
 * Ensures we're on a board (creates new if needed)
 * Handles both the new Start screen and legacy auto-create behavior
 */
export async function ensureOnBoard(page: Page) {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Give the app a moment to determine its state
  await page.waitForTimeout(1000);

  const url = page.url();
  if (!url.includes('#doc=')) {
    // Check if we're on the Start screen (new behavior)
    const isStartScreen = await page.getByRole('button', { name: /neuen workspace erstellen/i })
      .isVisible({ timeout: 2000 })
      .catch(() => false);

    if (isStartScreen) {
      // Create workspace from Start screen
      await createWorkspaceFromStart(page);
    } else {
      // Try to create a new board via workspace switcher (fallback)
      try {
        await createNewBoard(page);
      } catch {
        // If workspace switcher doesn't work, the app might auto-create a doc
        // Wait a bit and check again
        await page.waitForTimeout(2000);
        if (!page.url().includes('#doc=')) {
          // Last resort: reload and hope for auto-creation
          await page.reload();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  }

  // Final verification: wait for a "New Assumption" button to be visible
  // This indicates the workspace is fully loaded
  // Use .first() since there might be multiple buttons (one in empty state, one floating)
  const newAssumptionButton = page.getByRole('button', { name: /new assumption/i }).first();
  await expect(newAssumptionButton).toBeVisible({ timeout: 15000 });
}
