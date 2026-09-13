import assert from 'node:assert/strict';
import type { Page } from 'playwright';

/** Both comparison canvases manipulate one pose; the reference photo follows that camera's z=0 projection. */
export async function checkShapeCloudLinkedPose(page: Page) {
  const root = page.locator('[data-shape-cloud-root]'), source = page.locator('.shape-cloud-source-slot'), cloud = page.locator('.shape-cloud-output-slot');
  const registration = await source.locator('[data-cloud-source-frame]').getAttribute('style');
  await page.getByRole('button', { name: 'Earth view', exact: true }).click();
  assert.equal(await source.locator('[data-image-axis="earth"]').getAttribute('data-end-on'), 'toward');
  await page.getByRole('button', { name: 'Unlock rotation', exact: true }).click();
  async function drag(slot: typeof source, dx: number, dy: number) {
    const bounds = await slot.locator('.shape-cloud-viewport').boundingBox(); assert.ok(bounds);
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2); await page.mouse.down();
    await page.mouse.move(bounds.x + bounds.width / 2 + dx, bounds.y + bounds.height / 2 + dy); await page.mouse.up();
  }
  async function linked() {
    await page.waitForFunction(() => {
      const pose = document.querySelector('[data-shape-cloud-root]')?.getAttribute('data-pose');
      return pose && pose !== '0,0' && [...document.querySelectorAll('[data-photo-pose], [data-orientation-pose]')].every(node =>
        (node.getAttribute('data-photo-pose') ?? node.getAttribute('data-orientation-pose')) === pose);
    });
    assert.equal(await source.locator('.shape-cloud-photo-pose').getAttribute('style'), await cloud.locator('.shape-cloud-photo-pose').getAttribute('style'));
    assert.equal(await source.locator('.shape-cloud-photo-pose').evaluate(node => getComputedStyle(node).transform),
      await source.locator('.shape-cloud-guide-pose').evaluate(node => getComputedStyle(node).transform), 'Photo and its guide projections differ.');
    assert.equal(await source.locator('[data-cloud-source-frame]').getAttribute('style'), registration, 'Rotation changed the registered source frame.');
  }
  await drag(source, 58, -32); await linked(); const sourcePose = await root.getAttribute('data-pose');
  const photoTransform = await source.locator('.shape-cloud-photo-pose').evaluate(node => getComputedStyle(node).transform);
  assert.notEqual(photoTransform, 'matrix(1, 0, 0, 1, 0, 0)', 'Source drag left the photograph stationary.');
  await drag(cloud, 40, 22); await linked(); assert.notEqual(await root.getAttribute('data-pose'), sourcePose);
  const beforePan = await root.getAttribute('data-pose'), framing = await source.locator('.shape-cloud-frame').getAttribute('style');
  await page.keyboard.down('Shift'); await drag(source, 24, 18); await page.keyboard.up('Shift');
  assert.equal(await root.getAttribute('data-pose'), beforePan, 'Shift-drag rotated instead of panning.');
  assert.notEqual(await source.locator('.shape-cloud-frame').getAttribute('style'), framing);
  await page.getByRole('button', { name: 'Earth view', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('[data-shape-cloud-root]')?.getAttribute('data-pose') === '0,0');
  assert.equal(await source.locator('.shape-cloud-photo-pose').evaluate(node => getComputedStyle(node).transform), 'matrix(1, 0, 0, 1, 0, 0)');
  assert.equal(await source.locator('[data-cloud-source-frame]').getAttribute('style'), registration);
  assert.equal(await source.locator('[data-image-axis="earth"]').getAttribute('data-end-on'), 'toward');
  return { sourceDragPose: sourcePose, cloudDragPose: beforePan, photoTransform };
}
