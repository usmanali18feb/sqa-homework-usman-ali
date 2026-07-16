import { expect, test, type Locator, type Page } from '@playwright/test';

const QUICK_PROMPT_RE = /what is permission|how to earn ask|what is ask|permission agent|earn ask/i;
const WELCOME_RE = /would you like to know about permission\.ai|how to earn ask/i;

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
  await page.goto('/');
  await dismissCookieBannerIfVisible(page);
  await expect(page.getByPlaceholder(/ask anything/i)).toBeVisible();
}

async function findSuggestedTopicButton(page: Page): Promise<Locator | null> {
  const allButtons = page.locator('button, [role="button"]');
  const count = await allButtons.count();

  for (let i = 0; i < count; i += 1) {
    const candidate = allButtons.nth(i);
    const text = (await candidate.innerText().catch(() => '')).trim();
    if (!text) {
      continue;
    }

    const isAuxButton = /log in|sign up|cookies|manage settings|allow all|accept all|reject all/i.test(text);
    if (!isAuxButton && QUICK_PROMPT_RE.test(text) && (await candidate.isVisible().catch(() => false))) {
      return candidate;
    }
  }

  return null;
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
    await gotoLanding(page);

    await expect
      .poll(
        async () => {
          const topicButton = await findSuggestedTopicButton(page);
          const hasWelcomeHint = await page
            .getByText(WELCOME_RE)
            .isVisible()
            .catch(() => false);
          const hasGreetingHint = await page
            .getByText(/how can i help you today/i)
            .isVisible()
            .catch(() => false);

          return Boolean(topicButton) || hasWelcomeHint || hasGreetingHint;
        },
        {
          timeout: 20_000,
          message: 'Expected either suggested-topic chips or a suggestion-oriented greeting hint',
        }
      )
      .toBeTruthy();
  });

  test('2) selecting a suggested topic produces an agent response', async ({ page }) => {
    await gotoLanding(page);

    const topicButton = await findSuggestedTopicButton(page);
    const previousAssistantCount = await assistantBubbles(page).count();

    if (topicButton) {
      await topicButton.click();
    } else {
      test.info().annotations.push({
        type: 'note',
        description: 'No topic chips in this build; used canonical quick prompt fallback.',
      });
      await page.getByPlaceholder(/ask anything/i).fill('What is Permission?');
      await page.getByPlaceholder(/ask anything/i).press('Enter');
    }

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
