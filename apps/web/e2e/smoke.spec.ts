import { test, expect } from '@playwright/test';

// Self-contained smoke test that does not require the Next.js dev server.
// Feature E2Es in Phase 8 will spin up the dev server via webServer config.
test('playwright runtime works against a data URL', async ({ page }) => {
  await page.goto('data:text/html,<h1 data-testid="hi">audience-wordcloud</h1>');
  await expect(page.getByTestId('hi')).toHaveText('audience-wordcloud');
});
