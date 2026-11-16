import { test, expect, type Page } from '@playwright/test';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const KEY = 'crt-builder-v1';

async function fresh(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('./');
  await expect(page.locator('#modal')).toHaveClass(/open/); // first run shows help
  await page.click('#bCloseHelp');
  return errors;
}
const nodeCount = (page: Page) => page.locator('#vp [data-node]').count();
const stored = (page: Page) => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), KEY);

test('first run shows the example tree and saves it', async ({ page }) => {
  const errors = await fresh(page);
  await expect(page.locator('#vp [data-node]')).toHaveCount(10);
  await expect(page.locator('#vp .andE')).toHaveCount(1);
  await expect(page.locator('#insp h3')).toHaveText('Example: late deliveries');
  const s = await stored(page);
  expect(Object.keys(s.trees)).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('adding an entity persists across reload', async ({ page }) => {
  await fresh(page);
  await page.click('#bAddUde');
  await page.locator('#iText').fill('Morale is low');
  await page.waitForTimeout(500);
  await page.reload();
  await expect(page.locator('#vp [data-node]')).toHaveCount(11);
  await expect(page.locator('#vp .node.ude', { hasText: 'Morale is low' })).toHaveCount(1);
  await expect(page.locator('#modal')).not.toHaveClass(/open/);
});

test('dragging a handle onto empty space creates a connected cause', async ({ page }) => {
  await fresh(page);
  await page.click('#bTrees'); await page.click('#bNewTree'); await page.keyboard.press('Escape');
  await page.click('#bAddUde');
  await page.locator('#iText').fill('Top effect');
  await page.keyboard.press('Escape');
  const node = page.locator('#vp .node', { hasText: 'Top effect' });
  await node.hover();
  const h = node.locator('[data-dir="down"]');
  const b = (await h.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + 60, b.y + 160, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator('#vp [data-node]')).toHaveCount(2);
  await expect(page.locator('#vp [data-edge]')).toHaveCount(1);
  await expect(page.locator('#insp')).toContainText('Leads to');
  await expect(page.locator('#insp')).toContainText('Top effect');
  await page.locator('#iText').fill('Root');
  await page.keyboard.press('Escape');
  await expect(page.locator('#vp .node.root', { hasText: 'Root' })).toHaveCount(1);
  await page.keyboard.press('Control+z');
  await page.keyboard.press('Control+z');
  await expect(page.locator('#vp [data-node]')).toHaveCount(1);
});

test('switch between several trees without export/import', async ({ page }) => {
  await fresh(page);
  // create a second tree from the library
  await page.click('#bTrees');
  await expect(page.locator('#library')).toHaveClass(/open/);
  await page.click('#bNewTree');
  await expect(page.locator('#treeName')).toBeFocused();
  await page.keyboard.type('Sales CRT');
  await page.keyboard.press('Escape');
  await page.click('#bAddUde');
  await page.locator('#iText').fill('Win rate is falling');
  await page.keyboard.press('Escape');
  expect(await nodeCount(page)).toBe(1);
  await expect(page).toHaveURL(/#tree=/);
  const salesUrl = page.url();

  // switch back to the example via the library
  await page.keyboard.press('t');
  await expect(page.locator('#libList li[data-tree]')).toHaveCount(2);
  await expect(page.locator('#libList li.current .nm')).toHaveText('Sales CRT');
  await page.locator('#libList li', { hasText: 'Example: late deliveries' }).click();
  await expect(page.locator('#library')).not.toHaveClass(/open/);
  expect(await nodeCount(page)).toBe(10);
  await expect(page.locator('#treeCount')).toHaveText('2');

  // undo history is per tree: undo in the example does nothing, back in Sales it removes the UDE
  await expect(page.locator('#bUndo')).toBeDisabled();
  await page.goto(salesUrl);
  await page.reload();
  await expect(page.locator('#treeName')).toHaveValue('Sales CRT');
  expect(await nodeCount(page)).toBe(1);

  // search + rename + duplicate + delete with undo
  await page.click('#bTrees');
  await page.fill('#libSearch', 'exam');
  await expect(page.locator('#libList li[data-tree]')).toHaveCount(1);
  await page.fill('#libSearch', '');
  const ex = page.locator('#libList li', { hasText: 'Example' });
  await ex.hover();
  await ex.locator('[data-act="rename"]').click();
  await page.locator('#libList input.rename').fill('Plant CRT');
  await page.keyboard.press('Enter');
  await expect(page.locator('#libList li', { hasText: 'Plant CRT' })).toHaveCount(1);
  const plant = page.locator('#libList li', { hasText: 'Plant CRT' });
  await plant.hover();
  await plant.locator('[data-act="dup"]').click();
  await expect(page.locator('#treeName')).toHaveValue('Plant CRT (copy)');
  expect(await nodeCount(page)).toBe(10);
  const copy = page.locator('#libList li', { hasText: 'Plant CRT (copy)' });
  await expect(page.locator('#libList li[data-tree]')).toHaveCount(3);
  await copy.locator('[data-act="del"]').click();
  await expect(page.locator('#libList li[data-tree]')).toHaveCount(2);
  await expect(page.locator('#toast')).toHaveClass(/show/);
  await page.click('#toastBtn');
  await expect(page.locator('#libList li[data-tree]')).toHaveCount(3);
  await expect(page.locator('#treeName')).toHaveValue('Plant CRT (copy)');

  const s = await stored(page);
  expect(Object.values(s.trees).map((t: any) => t.name).sort()).toEqual(['Plant CRT', 'Plant CRT (copy)', 'Sales CRT']);
});

test('data written by the original single-file crt.html loads unchanged', async ({ page }) => {
  await page.addInitScript(k => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem(k, JSON.stringify({
      currentId: 'b',
      trees: {
        a: { id: 'a', name: 'Old A', nodes: [], edges: [], nextNum: 1, view: null, updated: 1 },
        b: {
          id: 'b', name: 'Old B', nextNum: 3, view: { x: 400, y: 300, k: 1 }, updated: 2,
          nodes: [
            { id: 'n1', num: 1, type: 'entity', text: 'Cause', x: 0, y: 100, core: true, notes: '', clr: { clarity: 'ok' } },
            { id: 'n2', num: 2, type: 'ude', text: 'Effect', x: 0, y: -50, core: false, notes: '', clr: {} },
          ],
          edges: [{ id: 'e1', from: 'n1', to: 'n2', andGroup: null, clr: { causality: 'raised' } }],
        },
      },
    }));
  }, KEY);
  await page.goto('./');
  await expect(page.locator('#modal')).not.toHaveClass(/open/);
  await expect(page.locator('#treeName')).toHaveValue('Old B');
  await expect(page.locator('#vp .node.core')).toHaveCount(1);
  await expect(page.locator('#vp .edge.raised')).toHaveCount(1);
  await expect(page.locator('#treeCount')).toHaveText('2');
});

test('other tabs see new trees', async ({ context }) => {
  const a = await context.newPage();
  await a.goto('./'); await a.click('#bCloseHelp');
  const b = await context.newPage();
  await b.goto('./');
  await expect(b.locator('#treeCount')).toHaveText('1');
  await a.click('#bTrees'); await a.click('#bNewTree');
  await expect(b.locator('#treeCount')).toHaveText('2');
  await expect(b.locator('#treeName')).toHaveValue('Example: late deliveries');
});

test('single-file build works from file://', async ({ page }) => {
  const f = resolve('dist-single/index.html');
  test.skip(!existsSync(f), 'run `npm run build:single` first');
  const errors: string[] = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(pathToFileURL(f).href);
  await expect(page.locator('#vp [data-node]')).toHaveCount(10);
  expect(errors).toEqual([]);
});
