/** Actual sources, explicit server preparation, retained material switches and registered comparison. */
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { readStructureCatalogue } from '../alignment/observations-ui/structures-model';

const cataloguePath = '.local/nebula-lab/observations/helix/structures/catalogue.json';
const catalogue = readStructureCatalogue(JSON.parse(await readFile(cataloguePath, 'utf8')));
const directory = '.local/nebula-lab/shape-cloud/browser'; await mkdir(directory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage(); const errors: string[] = [], writes: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('request', request => { if (request.method() === 'POST') writes.push(request.url()); });
const checks: unknown[] = [];
try {
  await page.goto(`${process.argv[2] ?? 'http://127.0.0.1:4331'}/reconstruction?subject=helix-model-prior`);
  await page.locator('.shape-cloud-workbench').waitFor();
  const modes = page.getByRole('group', { name: 'Cloud comparison mode', exact: true });
  assert.equal(await modes.getByRole('button').count(), 3);
  const sizes = await modes.getByRole('button').evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().height));
  assert.ok(sizes.every(size => size >= 64), 'Comparison buttons should be large, like alignment layer buttons.');
  assert.deepEqual(writes, [], 'Entering the inspector started processing.');
  for (const image of catalogue.images) {
    await page.locator('#structure-image').selectOption(image.id);
    await page.locator(`.shape-cloud-workbench[data-image-id="${image.id}"]`).waitFor();
    await page.locator('.shape-cloud-source-slot .shape-cloud-source').evaluate(async (node: HTMLImageElement) => node.decode());
    const before: number = writes.length;
    await page.locator('#shape-cloud-weight').press('ArrowRight');
    await page.getByRole('button', { name: 'Reset to detected', exact: true }).click();
    await modes.getByRole('button', { name: 'Overlay', exact: true }).click();
    await modes.getByRole('button', { name: 'Compare', exact: true }).click();
    assert.equal(writes.length, before, 'Edits or comparison modes started processing.');
    await page.locator('#shape-cloud-preview').click();
    await page.waitForFunction(() => document.querySelector('[data-shape-cloud-root]')?.getAttribute('data-ready') === 'true' ||
      Boolean(document.querySelector('.shape-cloud-error, .shape-cloud-empty[role="alert"]')), null, { timeout: 180_000 });
    const alertMessage: string = (await page.locator('.shape-cloud-error, .shape-cloud-empty[role="alert"]').allTextContents()).join('\n');
    assert.equal(await page.locator('.shape-cloud-error, .shape-cloud-empty[role="alert"]').count(), 0, alertMessage);
    const root = page.locator('[data-shape-cloud-root]');
    const rootNode = await root.elementHandle(); assert.ok(rootNode);
    const leaf = await root.locator('.css-volume-mesh s').first().elementHandle(); assert.ok(leaf, 'Preview has no real CSS volume leaves.');
    const resultId = await root.getAttribute('data-shape-cloud-root');
    const sourcePlane = page.locator('[data-cloud-source-frame="source"]'), cloudPlane = page.locator('[data-cloud-source-frame="cloud"]');
    assert.equal(await sourcePlane.getAttribute('style'), await cloudPlane.getAttribute('style'), 'Source and cloud lost their shared registration.');
    const sourceBounds = await sourcePlane.boundingBox(), cloudBounds = await cloudPlane.boundingBox(); assert.ok(sourceBounds && cloudBounds);
    assert.ok(Math.abs(sourceBounds.width - cloudBounds.width) < .01 && Math.abs(sourceBounds.height - cloudBounds.height) < .01);
    const initialPosts: number = writes.length;
    await modes.getByRole('button', { name: 'Textured', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-shape-cloud-root]')?.getAttribute('data-material') === 'textured');
    assert.equal(await rootNode.evaluate(node => node.isConnected), true);
    assert.equal(await leaf.evaluate(node => node.isConnected), true, 'Material changes replaced prepared cloud geometry.');
    await page.locator('.observation-structures-panel').evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${directory}/${image.id}-textured.png` });
    await modes.getByRole('button', { name: 'Overlay', exact: true }).click();
    await page.locator('.observation-structures-panel').evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${directory}/${image.id}-overlay.png` });
    await page.locator('#shape-cloud-overlay-opacity').press('End');
    assert.equal(await page.locator('.shape-cloud-render-host').evaluate(node => getComputedStyle(node).opacity), '1');
    await modes.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.getByRole('button', { name: 'Earth view', exact: true }).click();
    const point = await page.locator('.shape-cloud-source-slot .cloud-guide-hit').evaluateAll(nodes => {
      for (const node of nodes) {
        const curve = node as SVGEllipseElement, matrix = curve.getScreenCTM(), viewport = curve.closest('.shape-cloud-viewport')?.getBoundingClientRect();
        if (!matrix || !viewport) continue;
        for (let step = 0; step < 36; step++) {
          const local = curve.getPointAtLength(curve.getTotalLength() * step / 36), point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
          if (point.x > viewport.left + 12 && point.x < viewport.right - 12 && point.y > viewport.top + 12 && point.y < viewport.bottom - 12)
            return { x: point.x, y: point.y, id: curve.parentElement?.getAttribute('data-cloud-component') };
        }
      }
      return null;
    });
    assert.ok(point?.id, 'No inspectable outline lies inside the source viewport.');
    await page.mouse.move(point.x, point.y);
    const hovered = page.locator('.shape-cloud-source-slot .shape-cloud-guides g:hover');
    const hoveredId = await hovered.getAttribute('data-cloud-component');
    assert.ok(hoveredId);
    assert.equal(await hovered.locator('.cloud-guide-line').evaluate(node => getComputedStyle(node).stroke), 'rgb(255, 255, 255)');
    await page.mouse.click(point.x, point.y);
    assert.equal(await page.locator('#shape-cloud-component').inputValue(), hoveredId, 'Hover and click disagree about the selected component.');
    await page.mouse.move(20, 20);
    assert.equal(await page.locator(`.shape-cloud-source-slot [data-cloud-component="${hoveredId}"] .cloud-guide-line`).evaluate(node => getComputedStyle(node).stroke), 'rgb(241, 198, 139)', 'Persistent selection must remain distinct from hover.');
    await page.getByRole('button', { name: 'Unlock rotation', exact: true }).click();
    const bounds = await page.locator('.shape-cloud-output-slot .shape-cloud-viewport').boundingBox(); assert.ok(bounds);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + 65, bounds.y + bounds.height / 2 - 40); await page.mouse.up();
    assert.notEqual(await root.getAttribute('data-pose'), '0,0');
    await page.screenshot({ path: `${directory}/${image.id}-oblique.png` });
    await page.getByRole('button', { name: 'Earth view', exact: true }).click();
    await page.locator('#shape-cloud-weight').press('ArrowRight');
    assert.equal(await page.locator('.shape-cloud-status').getAttribute('data-unapplied'), 'true');
    const changedWeight = await page.locator('#shape-cloud-weight').inputValue();
    assert.equal(writes.length, initialPosts, 'Inspecting, rotating or editing started an extra job.');
    if (image.id === catalogue.images[0]!.id) {
      await page.reload(); await page.locator('[data-shape-cloud-root][data-ready="true"]').waitFor();
      assert.equal(await page.locator('#shape-cloud-weight').inputValue(), changedWeight, 'Refresh lost the draft.');
      assert.equal(await page.locator('[data-shape-cloud-root]').getAttribute('data-shape-cloud-root'), resultId, 'Refresh failed to reconnect the completed preview.');
      assert.equal(await page.locator('.shape-cloud-status').getAttribute('data-unapplied'), 'true');
    }
    await page.getByRole('button', { name: 'Reset to detected', exact: true }).click();
    await page.locator('.observation-structures-panel').evaluate(node => { node.scrollTop = 0; });
    await page.screenshot({ path: `${directory}/${image.id}-compare.png` });
    checks.push({ imageId: image.id, resultId, leafCount: await root.locator('.css-volume-mesh s').count() });
    console.log(`Verified shape cloud: ${image.id}`);
  }
  assert.deepEqual(errors, []);
  await writeFile(`${directory}/result.json`, JSON.stringify({ status: 'passed', checks, postCount: writes.length, errors }, null, 2));
  console.log(JSON.stringify({ status: 'passed', checks, postCount: writes.length }));
} catch (error) { await page.screenshot({ path: `${directory}/failure.png` }); throw error; }
finally { await browser.close(); }
