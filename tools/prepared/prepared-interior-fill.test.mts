import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { interiorFillInset, preparedSurfaceMean } from './prepared-interior-fill.mts';

test('reserves space for the complete antialiased circle, independent of body shape', () => {
  assert(interiorFillInset * (1+4/512) < 1);
});
test('averages active prepared pages together and ignores transparent padding', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-fill-'));
  try {
    const a=join(directory,'a.png'), b=join(directory,'b.png');
    await sharp(Buffer.from([100,20,40,255, 255,255,255,0]), {raw:{width:2,height:1,channels:4}}).png().toFile(a);
    await sharp(Buffer.from([20,60,80,255]), {raw:{width:1,height:1,channels:4}}).png().toFile(b);
    assert.equal(await preparedSurfaceMean([a,b]), 'rgb(60 40 60)');
  } finally { await rm(directory,{recursive:true,force:true}); }
});
test('write-mode preparation reads the surface mean from staged scene assets, not the published copy', async () => {
  const { withPreparedInteriorFill } = await import('./prepared-interior-fill.mts');
  const directory = await mkdtemp(join(tmpdir(), 'cssearth-fill-staged-'));
  try {
    const staged = join(directory, 'body-surface@2x.webp');
    await sharp(Buffer.from([10,20,30,255]), {raw:{width:1,height:1,channels:4}}).webp({lossless:true}).toFile(staged);
    type Fill = typeof withPreparedInteriorFill;
    const presentation = {
      id: 'body', tree: { scene: 0, nodes: [{ parent: null, tag: 'div', className: 'scene', properties: [], attributes: {}, style: '' }] },
      viewBindings: [], variants: [{ when: { lensId: 'surface' }, required: ['surface'], writes: [] }],
      assets: { entries: [{ key: 'surface', url: '/scenes/body/body-surface@2x.webp' }] },
    } as unknown as Parameters<Fill>[0];
    const disc = { center: [0, 0], radius: 1 } as unknown as Parameters<Fill>[1];
    const resolveStaged = (url: string) => join(directory, url.slice('/scenes/body/'.length));
    const filled = await withPreparedInteriorFill(presentation, disc, resolveStaged);
    const fill = filled.variants[0].writes.find(write => write.kind === 'style' && write.name === 'background-color');
    assert.equal(fill && 'value' in fill ? fill.value : undefined, 'rgb(10 20 30)');
    await assert.rejects(withPreparedInteriorFill(presentation, disc, directory), /ENOENT/);
  } finally { await rm(directory,{recursive:true,force:true}); }
});
