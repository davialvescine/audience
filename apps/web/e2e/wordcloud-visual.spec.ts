import { test, expect } from '@playwright/test';

/**
 * Visual snapshot of the WordCloudDisplay with pre-seeded data.
 *
 * Skipped by default — pre-requisites:
 *   1. Migrations 00330000 + 00340000 applied
 *   2. Service-role seed of N wordcloud_words rows for SEED_SLUG
 *   3. events.wordcloud_active=true for SEED_SLUG
 *
 * Tolerance is generous (5%) because Framer Motion animations + d3-cloud
 * spiral placement are deterministic-ish but not pixel-identical across
 * runs (random rotation seed).
 */
test.describe.skip('wordcloud visual regression', () => {
  const SLUG = process.env.E2E_VISUAL_SLUG ?? 'wordcloud-visual';

  test('snapshot of populated wordcloud telão', async ({ page }) => {
    await page.goto(`/telao/${SLUG}?mode=browser_source`);
    // wait for at least one word to appear
    await page.waitForSelector('[data-testid^="wc-word-"]', { timeout: 5000 });
    // give animations a beat to settle
    await page.waitForTimeout(2000);
    await expect(page).toHaveScreenshot('wordcloud-populated.png', {
      maxDiffPixelRatio: 0.05,
    });
  });
});
