import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'node:test';

// The world draws a body with its 256-pixel billboard, and the deploy build stops on a body whose billboard is not
// published (asset-origin.mts resolveWorldBillboards). 172 bodies added by other work had an arrival photograph and no
// billboard on 2026-10-01; this fails the pull request instead of the deploy.
test('every body with an arrival photograph of its own lists its world billboard', async () => {
  const objects = resolve(import.meta.dirname, '../../src/objects'), missing: string[] = [];
  for (const id of await readdir(objects)) {
    const text = await readFile(resolve(objects, id, 'inventory.json'), 'utf8').catch(() => null);
    if (text === null) continue;
    const files = new Set((JSON.parse(text) as { assets: { location: string; filename: string }[] }).assets
      .filter(asset => asset.location === 'public').map(asset => asset.filename));
    if (files.has(`${id}-arrival.webp`) && !files.has(`${id}-billboard.webp`)) missing.push(id);
  }
  assert.deepEqual(missing, [], `run pnpm prepare:world-billboards, publish and commit the inventories: ${missing.slice(0, 5).join(', ')}`);
});
