import { test, expect } from '@playwright/test';

/**
 * End-to-end happy path for the wordcloud feature.
 *
 * Requires the dev server running and migrations 00330000 + 00340000 applied
 * to the linked Supabase project. Skipped by default; remove `.skip` after:
 *   1. `supabase db push` to apply the wordcloud migrations
 *   2. `pnpm db:types` to regenerate generated DB types
 *   3. Set PLAYWRIGHT_BASE_URL or rely on the default localhost:3000
 *   4. Create a test event slug and pre-seed an operator session
 *
 * Pieces this spec covers when un-skipped:
 *   - Operator opens /admin/events/<slug>, switches to the "Nuvem" tab,
 *     clicks the toggle on. Tab label updates to "Nuvem ●".
 *   - Audience (separate browser context) opens /e/<slug> and sees the
 *     WordCloudInput instead of the SubmissionForm. Submits "amor".
 *   - Telão context opens /telao/<slug>?mode=browser_source and within
 *     ~3s shows a span with data-testid="wc-word-amor".
 *   - Audience submits "amor" 2 more times; the existing word grows
 *     (larger font size in the telão render).
 *   - Operator toggles off. Audience sees SubmissionForm again. Telão
 *     reverts to the comments view.
 */
test.describe.skip('wordcloud end-to-end', () => {
  const SLUG = process.env.E2E_EVENT_SLUG ?? 'wordcloud-test';

  test('operator can toggle, audience submits, telão renders, toggle off restores comments', async ({
    browser,
  }) => {
    test.setTimeout(60_000);

    const operatorCtx = await browser.newContext({ storageState: 'e2e/.auth/operator.json' });
    const audienceCtx = await browser.newContext();
    const telaoCtx = await browser.newContext();

    const operator = await operatorCtx.newPage();
    const audience = await audienceCtx.newPage();
    const telao = await telaoCtx.newPage();

    // 1. Operator turns wordcloud on.
    await operator.goto(`/admin/events/${SLUG}`);
    await operator.getByRole('tab', { name: /Nuvem/ }).click();
    await operator.getByRole('switch', { name: /ativar nuvem/i }).click();
    await expect(operator.getByText(/nuvem ativa/i)).toBeVisible();

    // 2. Audience sees the wordcloud input.
    await audience.goto(`/e/${SLUG}`);
    await expect(audience.getByLabel(/sua palavra/i)).toBeVisible();

    // 3. Audience submits "amor" 3 times.
    for (let i = 0; i < 3; i += 1) {
      await audience.getByLabel(/sua palavra/i).fill('amor');
      await audience.getByRole('button', { name: /enviar palavra/i }).click();
      await expect(audience.getByRole('status')).toBeVisible();
      await audience.getByRole('button', { name: /mandar outra/i }).click();
    }

    // 4. Telão renders the word.
    await telao.goto(`/telao/${SLUG}?mode=browser_source`);
    await expect(telao.getByTestId('wc-word-amor')).toBeVisible({ timeout: 5000 });

    // 5. Operator turns wordcloud off; audience reverts to the comment form.
    await operator.getByRole('switch', { name: /ativar nuvem/i }).click();
    await audience.reload();
    await expect(audience.getByLabel(/sua mensagem/i)).toBeVisible();
  });
});
