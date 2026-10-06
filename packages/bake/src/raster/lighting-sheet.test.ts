import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import sharp from 'sharp';
import { lightingFrame } from '../baking/index.ts';
import { LIGHTING_BANKS, LIGHTING_BANK_PRESENTATION_SIZE, LIGHTING_BANK_ROOT, LIGHTING_SHEET, lightingSheetAddress, lightingSheetLayout, lightingSheetViewZ,
  lightingShadowlessAddress, lightingShadowlessSize, prepareLighting } from './index.ts';

const root = resolve(import.meta.dirname, '../../../..');
const decode = async (path: string) => { const { data, info } = await sharp(path).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); return { data, width: info.width, height: info.height }; };

describe('lighting sheet', () => {
  it('spaces its frames evenly in the angle between the Sun and the camera, from behind the body to behind the camera', () => {
    const { frameCount } = LIGHTING_SHEET, angles = Array.from({ length: frameCount }, (_, frame) => Math.acos(-lightingSheetViewZ(frame)));
    assert.deepEqual([lightingSheetViewZ(0), lightingSheetViewZ(frameCount - 1)], [-1, 1]);
    for (let frame = 1; frame < frameCount; frame++) assert.ok(Math.abs(angles[frame]! - angles[frame - 1]! - Math.PI / (frameCount - 1)) < 1e-12, `frame ${frame}`);
    assert.throws(() => lightingSheetViewZ(frameCount), /outside the sheet/);
  });

  it('addresses each frame inside its own tile, in CSS pixels of the overlay it is drawn on', () => {
    const { frameSize, margin, columns, frameCount } = LIGHTING_SHEET, { tile, rowCount, width, height } = lightingSheetLayout();
    assert.deepEqual([tile, width, height, rowCount * columns], [frameSize + 2 * margin, columns * tile, rowCount * tile, frameCount]);
    // At the frame's own size an address is in sheet pixels: the frame starts one margin inside its tile.
    assert.deepEqual(lightingSheetAddress(0, frameSize), { backgroundPosition: `${-margin}px ${-margin}px`, backgroundSize: `${width}px ${height}px` });
    assert.deepEqual(lightingSheetAddress(columns + 1, frameSize).backgroundPosition, `${-(tile + margin)}px ${-(tile + margin)}px`);
    assert.deepEqual(lightingSheetAddress(columns + 1, 460), { backgroundPosition: '-481.5625px -481.5625px', backgroundSize: '7590px 3795px' });
  });

  it('keeps the flood-lit frame a file of its own, a pixel for each device pixel of a 2x screen', () => {
    assert.deepEqual([460, 256, 512, 513].map(lightingShadowlessSize), [1024, 512, 1024, 2048]);
    assert.deepEqual(lightingShadowlessAddress(460), { backgroundPosition: '0px 0px', backgroundSize: '460px 460px' });
    assert.throws(() => lightingShadowlessSize(0), /positive size/);
  });

  it('ends the lit disc inside its own tile, wider than the box it lights', () => {
    const { frameSize, radiusScale, margin } = LIGHTING_SHEET, { tile } = lightingSheetLayout();
    const pixels = lightingFrame({ size: tile, radius: frameSize * radiusScale }, -1, LIGHTING_BANKS.sphere!);
    const alpha = (x: number, y: number) => pixels[(y * tile + x) * 4 + 3];
    for (let i = 0; i < tile; i++) assert.deepEqual([alpha(i, 0), alpha(i, tile - 1), alpha(0, i), alpha(tile - 1, i)], [0, 0, 0, 0], `border ${i}`);
    // Lit from behind, the whole disc is at the law's darkest alpha: across the box, and a pixel past it into the margin.
    const middle = Math.round((tile - 1) / 2), darkest = Math.round(LIGHTING_BANKS.sphere!.maximumAlpha * 255);
    assert.deepEqual([alpha(middle, middle), alpha(margin, middle), alpha(margin - 1, middle), alpha(margin - 3, middle)], [darkest, darkest, darkest, 0]);
  });

  it('holds, in the tracked sphere bank, the pixels its law draws today', async () => {
    const { frameSize, radiusScale, columns, frameCount, sheetFile, shadowlessFile } = LIGHTING_SHEET, { tile, width, height } = lightingSheetLayout();
    const geometry = { size: tile, radius: frameSize * radiusScale }, law = LIGHTING_BANKS.sphere!;
    const sheet = await decode(resolve(root, LIGHTING_BANK_ROOT, 'sphere', sheetFile));
    assert.deepEqual([sheet.width, sheet.height], [width, height]);
    for (const frame of [0, 1, 37, 64, 126, frameCount - 1]) {
      const expected = lightingFrame(geometry, lightingSheetViewZ(frame), law), left = (frame % columns) * tile, top = Math.floor(frame / columns) * tile;
      for (let y = 0; y < tile; y++) assert.ok(Buffer.from(expected.subarray(y * tile * 4, (y + 1) * tile * 4)).equals(sheet.data.subarray(((top + y) * width + left) * 4, ((top + y) * width + left + tile) * 4)), `frame ${frame} row ${y}`);
    }
    const size = lightingShadowlessSize(LIGHTING_BANK_PRESENTATION_SIZE), flood = await decode(resolve(root, LIGHTING_BANK_ROOT, 'sphere', shadowlessFile));
    assert.deepEqual([flood.width, flood.height], [size, size]);
    assert.ok(Buffer.from(lightingFrame({ size, radius: size * radiusScale }, null, law)).equals(flood.data));
  });

  it('copies a named bank into a body and records one address per frame', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cssearth-lighting-sheet-'));
    try {
      const lighting = await prepareLighting({ publicBase: '/scenes/test/' }, { ...LIGHTING_BANKS.sphere!, bank: 'sphere', presentationSize: 460 }, directory);
      assert.deepEqual([lighting.frameCount, lighting.defaultFrame, lighting.sheet.url, lighting.shadowless.url, lighting.sheet.presentations.length],
        [LIGHTING_SHEET.frameCount, LIGHTING_SHEET.frameCount - 1, '/scenes/test/lighting-sheet.webp', '/scenes/test/lighting-2x-shadowless.webp', LIGHTING_SHEET.frameCount]);
      assert.deepEqual(lighting.sheet.presentations[17], { frameIndex: 17, lightViewZ: lightingSheetViewZ(17), ...lightingSheetAddress(17, 460) });
      const copied = await decode(join(directory, LIGHTING_SHEET.sheetFile)), tracked = await decode(resolve(root, LIGHTING_BANK_ROOT, 'sphere', LIGHTING_SHEET.sheetFile));
      assert.ok(copied.data.equals(tracked.data));
      // A bank's flood-lit frame is baked for one overlay size; a body with another states its own lighting.
      await assert.rejects(prepareLighting({ publicBase: '/scenes/test/' }, { ...LIGHTING_BANKS.sphere!, bank: 'sphere', presentationSize: 256 }, directory), /states its own lighting/);
      await assert.rejects(prepareLighting({ publicBase: '/scenes/test/' }, { bank: 'sphere', presentationSize: 460, limb: { models: ['a.json', 'a.json', 'a.json'] } } as never, directory), /lighting\.limb names models that were not loaded/);
    } finally { await rm(directory, { recursive: true, force: true }); }
  });
});
