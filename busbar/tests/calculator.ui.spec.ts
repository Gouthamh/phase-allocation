import { test, expect } from './fixtures';
import { conductorRow, kpi } from './helpers';

test.describe('UI regression', { tag: '@regression' }, () => {
  test('loads the calculator and shows the default API calculation',
    { tag: '@smoke' }, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Busbar phase balance calculator' })).toBeVisible();
      await expect(kpi(page, 'Busbar Ib')).toHaveText('319.3 A');
      await expect(kpi(page, 'Neutral current')).toHaveText('201.4 A');
      await expect(kpi(page, 'Most loaded phase')).toHaveText('Ph2');
      await expect(conductorRow(page, 'Ph2').getByRole('cell').nth(1)).toHaveText('319.3');
      await expect(page.getByRole('region', { name: 'Results' }).getByRole('row')).toHaveCount(5);
    });

  test('balanced example updates results through the API', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Example 3: balanced 3P' }).click();
    await expect(kpi(page, 'Busbar Ib')).toHaveText('120.0 A');
    await expect(kpi(page, 'Neutral current')).toHaveText('0.0 A');
    await expect(kpi(page, 'Unbalance')).toHaveText('0.0 %');
    for (const phase of ['Ph1', 'Ph2', 'Ph3']) {
      await expect(conductorRow(page, phase).getByRole('cell').nth(1)).toHaveText('120.0');
    }
  });

  test('editing current and lead direction recalculates the reactive result', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Example 1: P+N on Ph1' }).click();
    await expect(kpi(page, 'Busbar Ib')).toHaveText('100.0 A');
    await page.getByRole('spinbutton', { name: 'Load 1 current (A)', exact: true }).fill('200');
    await expect(kpi(page, 'Busbar Ib')).toHaveText('200.0 A');
    await expect(conductorRow(page, 'Ph1').getByRole('cell').nth(4)).toHaveText('-87.2');
    await page.getByRole('checkbox', { name: 'Load 1 leading' }).check();
    await expect(conductorRow(page, 'Ph1').getByRole('cell').nth(4)).toHaveText('87.2');
  });

  test('adds a load, changes its phase, and removes it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Example 1: P+N on Ph1' }).click();
    await expect(kpi(page, 'Busbar Ib')).toHaveText('100.0 A');
    await page.getByRole('button', { name: '+ Add load', exact: true }).click();
    await page.getByRole('textbox', { name: 'Load 2 name', exact: true }).fill('Second load');
    await page.getByRole('combobox', { name: 'Load 2 connection' }).selectOption('L2');
    await page.getByRole('spinbutton', { name: 'Load 2 current (A)', exact: true }).fill('150');
    await expect(kpi(page, 'Busbar Ib')).toHaveText('150.0 A');
    await expect(kpi(page, 'Most loaded phase')).toHaveText('Ph2');
    await expect(conductorRow(page, 'Ph2').getByRole('cell').nth(1)).toHaveText('150.0');
    await page.getByRole('button', { name: 'Remove load 2', exact: true }).click();
    await expect(kpi(page, 'Busbar Ib')).toHaveText('100.0 A');
    await expect(conductorRow(page, 'Ph2').getByRole('cell').nth(1)).toHaveText('0.0');
  });

  test('invalid input shows an error and valid input recovers', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Example 1: P+N on Ph1' }).click();
    await expect(kpi(page, 'Busbar Ib')).toHaveText('100.0 A');
    await page.getByRole('spinbutton', { name: 'Load 1 power factor', exact: true }).fill('0');
    await expect(page.getByRole('alert')).toHaveText(
      'Enter at least one load with current > 0 and 0 < cos \u03c6 \u2264 1.',
    );
    await expect(kpi(page, 'Busbar Ib')).toHaveCount(0);
    await page.getByRole('spinbutton', { name: 'Load 1 power factor', exact: true }).fill('0.8');
    await expect(kpi(page, 'Busbar Ib')).toHaveText('100.0 A');
    await expect(conductorRow(page, 'Ph1').getByRole('cell').nth(4)).toHaveText('-60.0');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('removing every load clears results and an example restores them', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Example 1: P+N on Ph1' }).click();
    await expect(kpi(page, 'Busbar Ib')).toHaveText('100.0 A');
    await page.getByRole('button', { name: 'Remove load 1', exact: true }).click();
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(kpi(page, 'Busbar Ib')).toHaveCount(0);
    await expect(page.getByRole('combobox')).toHaveCount(0);
    await page.getByRole('button', { name: 'Example 3: balanced 3P' }).click();
    await expect(kpi(page, 'Busbar Ib')).toHaveText('120.0 A');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('API failure is visible and a subsequent calculation recovers', async ({ page }) => {
    await page.route('**/api/calculate', (route) => route.fulfill({
      status: 503, contentType: 'application/json', body: '{"detail":"Service unavailable"}',
    }));
    await page.goto('/');
    await expect(page.getByRole('alert')).toHaveText('Request failed (503)');
    await expect(kpi(page, 'Busbar Ib')).toHaveCount(0);
    await page.unroute('**/api/calculate');
    await page.getByRole('button', { name: 'Example 3: balanced 3P' }).click();
    await expect(kpi(page, 'Busbar Ib')).toHaveText('120.0 A');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a deep link serves the SPA and still reaches the calculation API', async ({ page }) => {
    await page.goto('/phase-allocation/example');
    await expect(page.getByRole('heading', { name: 'Busbar phase balance calculator' })).toBeVisible();
    await expect(kpi(page, 'Busbar Ib')).toHaveText('319.3 A');
  });
});
