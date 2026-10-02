import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import test from 'node:test';
import { NEUTRAL_CATALOGUE_COLOR } from '@cssearth/objects';

// A body with no measured color shows one neutral gray everywhere: two grays would say two unmeasured bodies differ.
test('every catalogue color without a hue is the one neutral gray', async () => {
  const root = new URL('../../src/objects/', import.meta.url), strays: string[] = [];
  for (const id of await readdir(root)) {
    const text = await readFile(new URL(`${id}/object.json`, root), 'utf8').catch(() => null);
    if (text === null) continue;
    const catalog = (JSON.parse(text) as { properties?: { catalog?: { color?: unknown } } }).properties?.catalog;
    if (typeof catalog?.color !== 'string') continue;
    const color = catalog.color.toLowerCase(), [red, green, blue] = [1, 3, 5].map(offset => color.slice(offset, offset + 2));
    if (red === green && green === blue && color !== NEUTRAL_CATALOGUE_COLOR) strays.push(`${id} ${color}`);
  }
  assert.deepEqual(strays, [], `src/objects/<id>/object.json properties.catalog.color: a body with no measured color takes ${NEUTRAL_CATALOGUE_COLOR}`);
});
