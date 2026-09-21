import type { Page } from '@playwright/test';

// Shared sign-in flow for the e2e specs. Handles both auth modes:
//   - Guest mode (`openchoreo.features.auth.enabled=false`) — the card's
//     `Enter` button signs the user in directly.
//   - OAuth mode (default) — the card's `Sign In` button redirects to the
//     Thunder IDP, whose form is filled with the dev credentials.
// Override the credentials with E2E_USERNAME / E2E_PASSWORD.
//
// Returns true once the post-login shell is visible, false otherwise.
export async function signIn(page: Page): Promise<boolean> {
  // The sign-in card is rendered client-side after the SPA boots, so wait for
  // it to appear rather than checking immediately after `goto`.
  await page
    .getByRole('button', { name: /^(Enter|Sign In)$/ })
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 })
    .catch(() => undefined);

  for (const name of ['Enter', 'Sign In'] as const) {
    const btn = page.getByRole('button', { name });
    if (await btn.isVisible().catch(() => false)) {
      await btn.click();
      // Wait for the IDP form directly rather than `networkidle` — Thunder
      // keeps requests open, so networkidle can lag well behind the form.
      const username = page.locator('#username');
      const onIdp = await username
        .waitFor({ state: 'visible', timeout: 30_000 })
        .then(() => true)
        .catch(() => false);
      if (onIdp) {
        await username.fill(process.env.E2E_USERNAME ?? 'admin');
        await page
          .locator('#password')
          .fill(process.env.E2E_PASSWORD ?? 'admin');
        // Target the form's submit button explicitly — the IDP header also
        // renders a "Sign In" control that does not submit the form.
        await page.locator('button[type="submit"]').click();
        // Wait for the OAuth redirect back to the portal rather than
        // `networkidle`, which can resolve while still on the IDP.
        await page
          .waitForURL(/localhost:3000/, { timeout: 30_000 })
          .catch(() => undefined);
        await page.waitForLoadState('networkidle').catch(() => undefined);
      }
      break;
    }
  }

  // The portal shell renders after the redirect; the Home link is always
  // visible once it is up (the sidebar nav can be present-but-hidden).
  return page
    .locator('a[href="/"][aria-label="Home"]')
    .first()
    .waitFor({ state: 'visible', timeout: 20_000 })
    .then(() => true)
    .catch(() => false);
}