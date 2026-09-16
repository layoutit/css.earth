import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Page } from 'playwright';
import { readGeometryMap } from '../src/features/observations/models/geometry-model';
import type { StructureImage } from '../src/features/observations/models/structures-model';

/** Exercise actual prepared detections without replacing the real source data. */
export async function checkObservationGeometry(page: Page, image: StructureImage, directory: string) {
  assert.ok(image.geometry, `${image.id} has no prepared geometry reference.`);
  const geometry = readGeometryMap(JSON.parse(await readFile(`${image.directory}/${image.geometry.file}`, 'utf8')), image);
  const plane = page.locator(`[data-structure-image="${image.id}"]`);
  const modes = page.getByRole('group', { name: 'Structure inspection mode' });
  await modes.getByRole('button', { name: 'Shapes', exact: true }).click();
  const detectedLines = page.getByRole('button', { name: 'Detected lines', exact: true });
  if (await detectedLines.isVisible()) await detectedLines.click();
  const svg = plane.locator('.structure-geometry'); await svg.waitFor();
  const shape = svg.locator('[data-shape-id]').first(); await shape.waitFor({ state: 'attached' });
  const node = await shape.elementHandle(); assert.ok(node);
  const shapes = svg.locator('[data-shape-id][data-visible="true"]');
  assert.equal(await shapes.count(), geometry.candidates.length);
  const bounds = await plane.boundingBox(), shapeBounds = await svg.boundingBox(); assert.ok(bounds && shapeBounds);
  for (const key of ['x', 'y', 'width', 'height'] as const)
    assert.ok(Math.abs(bounds[key] - shapeBounds[key]) < .05, `Shapes use a different registered ${key}.`);
  const camera = await page.locator('.observation-structure-frame').getAttribute('style');
  const score = page.locator('#structure-shape-score'); await score.press('End');
  assert.equal(await shapes.count(), geometry.candidates.filter(candidate => candidate.score >= 1).length);
  await score.press('Home'); assert.equal(await shapes.count(), geometry.candidates.length);
  await page.getByRole('checkbox', { name: 'Show all shapes', exact: true }).uncheck();
  assert.equal(await shapes.count(), geometry.candidates.length > 0 ? 1 : 0);
  if (geometry.candidates.length > 1) {
    const first = await page.locator('[data-selected-shape]').getAttribute('data-selected-shape');
    await page.getByRole('button', { name: 'Next shape', exact: true }).click();
    assert.notEqual(await page.locator('[data-selected-shape]').getAttribute('data-selected-shape'), first);
    await page.getByRole('button', { name: 'Previous shape', exact: true }).click();
  }
  await page.getByRole('checkbox', { name: 'Show all shapes', exact: true }).check();
  assert.equal(await node.evaluate(element => element.isConnected), true, 'Shape filters recreated nodes.');
  assert.equal(await page.locator('.observation-structure-frame').getAttribute('style'), camera);
  // Start dragging on an ellipse stroke, not just the empty canvas behind it.
  const point = await svg.locator('.geometry-hit').evaluateAll(nodes => {
    for (const node of nodes) {
      const curve = node as SVGEllipseElement, matrix = curve.getScreenCTM(); if (!matrix) continue;
      for (let step = 0; step < 36; step++) {
        const local = curve.getPointAtLength(curve.getTotalLength() * step / 36);
        const p = new DOMPoint(local.x, local.y).matrixTransform(matrix);
        if (p.x > 360 && p.x < innerWidth - 370 && p.y > 140 && p.y < innerHeight - 40) return { x: p.x, y: p.y };
      }
    }
    return null;
  });
  assert.ok(point, 'No inspectable ellipse stroke in the viewport.');
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  await page.mouse.move(point.x + 22, point.y + 14); await page.mouse.up();
  assert.notEqual(await page.locator('.observation-structure-frame').getAttribute('style'), camera, 'Ellipse strokes blocked pan.');
  await page.getByRole('button', { name: 'Fit all images', exact: true }).click();
  await page.screenshot({ path: `${directory}/${image.id}-shapes.png` });
  await modes.getByRole('button', { name: 'Regions', exact: true }).click();
  assert.equal(await svg.isVisible(), false);
  assert.equal(await node.evaluate(element => element.isConnected), true, 'Mode switching discarded detections.');
  return { id: image.id, candidates: geometry.candidates.length, geometrySha256: image.geometry.sha256 };
}
