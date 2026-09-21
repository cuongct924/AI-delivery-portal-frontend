import { test, expect } from '@playwright/test';
import { signIn } from './signIn';

// Regression coverage for the create page's landing view: the "Platform
// Resources" and "AI Delivery Workflows" sections are data-driven off the
// catalog's Template entities, so they silently disappear when the
// `catalog.locations` file targets stop resolving (see app-config.yaml).
//
// Run locally: start the portal (`yarn start`) against an OpenChoreo runtime,
// then `PLAYWRIGHT_URL=http://localhost:3000 yarn test:e2e`.
test('create page renders Platform Resources and AI Delivery Workflows', async ({
  page,
}) => {
  await page.goto('/create');
  await signIn(page);
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await expect(
    page.getByText('Platform Resources', { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(
    page.getByText('AI Delivery Workflows', { exact: true }),
  ).toBeVisible({ timeout: 20_000 });

  // Spot-check one card from each section so an empty grid still fails.
  await expect(
    page.getByText('Namespace', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText('Train & Register Model', { exact: true }).first(),
  ).toBeVisible();
});