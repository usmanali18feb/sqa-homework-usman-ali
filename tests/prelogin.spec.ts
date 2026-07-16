import { expect, test, type Locator, type Page } from '@playwright/test';

function assistantBubbles(page: Page): Locator {
  return page.locator('div.flex.justify-start div.text-md');
}

async function dismissCookieBannerIfVisible(page: Page): Promise<void> {
  const rejectAll = page.getByRole('button', { name: /reject all/i }).first();
  if (await rejectAll.isVisible().catch(() => false)) {
    await rejectAll.click();
  }
}

async function gotoLanding(page: Page): Promise<void> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 35_000 });
      await dismissCookieBannerIfVisible(page);
      await expect(page.getByPlaceholder(/ask anything/i)).toBeVisible({ timeout: 10_000 });
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await page.waitForTimeout(800 * attempt);
      }
    }
  }

  throw lastError;
}

async function waitForSuggestedTopics(page: Page): Promise<Locator> {
  const firstTopic = page.getByRole('button', { name: /what is permission/i }).first();

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLanding(page);

    const start = Date.now();
    while (Date.now() - start < 12_000) {
      if (await firstTopic.isVisible().catch(() => false)) {
        return firstTopic;
      }
      await page.waitForTimeout(300);
    }

    if (attempt < 5) {
      await page.waitForTimeout(800 * attempt);
    }
  }

  throw new Error('Suggested-topic pills were not visible after retries.');
}

async function waitForStableText(locator: Locator, timeoutMs = 30_000, stableForMs = 1_200): Promise<string> {
  const start = Date.now();
  let lastText = '';
  let lastChangeAt = Date.now();

  while (Date.now() - start < timeoutMs) {
    const nextText = (await locator.innerText()).trim();

    if (nextText !== lastText) {
      lastText = nextText;
      lastChangeAt = Date.now();
    } else if (nextText.length > 0 && Date.now() - lastChangeAt >= stableForMs) {
      return nextText;
    }

    await locator.page().waitForTimeout(250);
  }

  return (await locator.innerText()).trim();
}

async function waitForNewAssistantResponse(page: Page, previousCount: number): Promise<string> {
  const bubbles = assistantBubbles(page);

  await expect
    .poll(async () => bubbles.count(), {
      timeout: 45_000,
      message: 'Waiting for a new assistant bubble',
    })
    .toBeGreaterThan(previousCount);

  const newest = bubbles.nth(previousCount);
  await expect(newest).toBeVisible();

  const stableText = await waitForStableText(newest);
  expect(stableText.length, 'Assistant response should not be empty').toBeGreaterThan(20);

  return stableText;
}

async function sendQuestion(page: Page, message: string): Promise<string> {
  const input = page.getByPlaceholder(/ask anything/i);
  const previousAssistantCount = await assistantBubbles(page).count();

  await input.fill(message);
  await input.press('Enter');

  return waitForNewAssistantResponse(page, previousAssistantCount);
}

test.describe('ask.permission.ai pre-login', () => {
  test('1) landing page shows suggested-topic affordance', async ({ page }) => {
    const topic = await waitForSuggestedTopics(page);
    await expect(topic).toBeVisible();
  });

  test('2) selecting a suggested topic produces an agent response', async ({ page }) => {
    const topicButton = await waitForSuggestedTopics(page);
    const previousAssistantCount = await assistantBubbles(page).count();

    await topicButton.click();

    const response = (await waitForNewAssistantResponse(page, previousAssistantCount)).toLowerCase();
    const keySignals = ['permission', 'data', 'earn', 'agent', 'consent', 'ask'];
    const hitCount = keySignals.filter((word) => response.includes(word)).length;

    expect(response.length).toBeGreaterThan(100);
    expect(response).toContain('permission');
    expect(hitCount).toBeGreaterThanOrEqual(2);
  });

  test('3) free-text ASK question produces an agent response', async ({ page }) => {
    await gotoLanding(page);

    const response = await sendQuestion(page, 'How can I earn ASK as a new user?');

    expect(response.length).toBeGreaterThan(40);
    expect(response.toLowerCase()).toMatch(/ask|earn|permission|agent/);
  });

  test('4) Shift+Enter creates a newline instead of sending', async ({ page }) => {
    await gotoLanding(page);

    const input = page.getByPlaceholder(/ask anything/i);
    const assistantCountBefore = await assistantBubbles(page).count();

    await input.fill('Line one');
    await input.press('Shift+Enter');
    await input.type('Line two');

    const value = await input.inputValue();
    expect(value).toContain('\n');

    await page.waitForTimeout(800);
    await expect(assistantBubbles(page)).toHaveCount(assistantCountBefore);

    await input.press('Enter');
    await waitForNewAssistantResponse(page, assistantCountBefore);
  });

  test('5) Log in control navigates to an auth experience', async ({ page }) => {
    await gotoLanding(page);

    const startUrl = page.url();
    await page.getByRole('button', { name: /log in/i }).click();

    await expect
      .poll(async () => page.url(), { timeout: 15_000 })
      .not.toBe(startUrl);

    expect(page.url().toLowerCase()).toMatch(/log|auth|sign|permission\.ai/);
  });

  test('6) Sign Up control navigates to registration', async ({ page }) => {
    await gotoLanding(page);

    const startUrl = page.url();
    await page.getByRole('button', { name: /sign up/i }).click();

    await expect
      .poll(async () => page.url(), { timeout: 15_000 })
      .not.toBe(startUrl);

    expect(page.url().toLowerCase()).toMatch(/sign|register|auth|permission\.ai/);
  });

  test('7) send button disables for empty input and enables when text exists', async ({ page }) => {
    await gotoLanding(page);

    const input = page.getByPlaceholder(/ask anything/i);
    const sendButton = input
      .locator('xpath=ancestor::div[1]/following-sibling::div//button')
      .first();

    await input.fill('');
    await expect(sendButton).toBeDisabled();

    await input.fill('hi');
    await expect(sendButton).toBeEnabled();

    await input.fill('');
    await expect(sendButton).toBeDisabled();
  });

  test('8) mobile viewport keeps chat input usable without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await gotoLanding(page);

    await expect(page.getByPlaceholder(/ask anything/i)).toBeVisible();

    const hasHorizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1
    );
    expect(hasHorizontalOverflow).toBeFalsy();

    await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
  });

});
