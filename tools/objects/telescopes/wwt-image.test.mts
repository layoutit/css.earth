import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import sharp from 'sharp';
import { sourceTest } from '../../../tests/objects/source-test.mts';
import { parseWwtCatalogLines } from './wwt-catalog.mts';
import { exportWwtImage } from './wwt-image.mts';

const test = sourceTest();
const root = resolve(import.meta.dirname, '../../..');

test('a saved WWT TAN entry becomes one pinned static PNG without network access in the test', async () => {
  const catalog = parseWwtCatalogLines(await readFile(resolve(root, 'data/wwt/core-imagesets.jsonl'), 'utf8'));
  const imageset = catalog.imagesets.find(row => row.name === 'VST snaps a very detailed view of the Triangulum Galaxy');
  assert.ok(imageset);
  const work = await mkdtemp(resolve(tmpdir(), 'wwt-image-test-'));
  try {
    const explore = resolve(work, 'explore.json'), out = resolve(work, 'out');
    await writeFile(explore, JSON.stringify({ schema: 'cssearth-telescope-exploration@1', target: 'm33',
      answer: { curatedImagery: { state: 'indexed', revision: catalog.source.revision, matches: [imageset] } } }));
    const colors = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [255, 255, 0]] as const;
    const seen: string[] = [];
    const request = async (url: string): Promise<Response> => {
      seen.push(url);
      const match = /L1X([01])Y([01])\.png$/u.exec(url); assert.ok(match);
      const [r, g, b] = colors[Number(match[2]) * 2 + Number(match[1])]!;
      const tile = await sharp({ create: { width: 256, height: 256, channels: 4, background: { r, g, b, alpha: 1 } } }).png().toBuffer();
      return new Response(tile, { status: 200 });
    };
    const result = await exportWwtImage(root, explore, 1, 1, out, request);
    assert.equal(result.value.tiles.length, 4);
    assert.equal(result.value.imageset.credits, 'ESO');
    assert.ok(seen.every(url => url.startsWith('https://data1.wwtassets.org/')));
    const image = await sharp(result.image).raw().toBuffer({ resolveWithObject: true });
    assert.equal(image.info.width, 512); assert.equal(image.info.height, 512);
    const pixel = (x: number, y: number) => [...image.data.subarray(4 * (y * 512 + x), 4 * (y * 512 + x) + 3)];
    assert.deepEqual(pixel(1, 1), colors[0]); assert.deepEqual(pixel(511, 1), colors[1]);
    assert.deepEqual(pixel(1, 511), colors[2]); assert.deepEqual(pixel(511, 511), colors[3]);
    assert.equal(JSON.parse(await readFile(result.receipt, 'utf8')).output.sha256, result.value.output.sha256);
    await assert.rejects(exportWwtImage(root, explore, 1, 1, out, request), /already exists/u);
    assert.equal(seen.length, 4); // A repeated command must not redownload tiles.
    await assert.rejects(exportWwtImage(root, explore, 1, 4, resolve(work, 'too-large'), request), /--level/u);
    const changed = { ...imageset, position: { ...imageset.position, centerXDegrees: 0 } };
    await writeFile(explore, JSON.stringify({ schema: 'cssearth-telescope-exploration@1', target: 'm33',
      answer: { curatedImagery: { state: 'indexed', revision: catalog.source.revision, matches: [changed] } } }));
    await assert.rejects(exportWwtImage(root, explore, 1, 0, resolve(work, 'changed'), request), /differs from the pinned catalog/u);
  } finally { await rm(work, { recursive: true, force: true }); }
});
