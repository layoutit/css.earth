import { sourceTest } from '@cssearth/objects/node/source-test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { parseSolidLighting, prepareSolidMaterial } from '@cssearth/bake/objects/layers/terrestrial';
import { LIGHTING_BANKS, LIGHTING_SHEET, lightingSheetLayout } from '@cssearth/bake/raster';
const test = sourceTest();

const model = 'photometry/fixture-akimov.json', models: [string, string, string] = [model, model, model], limb = { models, reference: 'reference.png' };
// Rhea at 599 nm, Filacchione et al. (2022) Table 6: the Akimov disk function with a quadratic phase curve.
const record = { schema: 'cssearth-photometric-model@1', id: 'fixture-akimov', instrument: 'fixture', filter: 'fixture', quantity: 'radiance-factor',
  model: { family: 'separable', disk: { family: 'akimov' }, phase: { family: 'quadratic', constant: 0.610461, perDegree: -0.00352956, perDegreeSquared: -1.0071e-06, heldBeyondDegrees: 120 } },
  fit: { phaseDegrees: [10, 120], incidenceDegrees: [0, 70], emissionDegrees: [0, 70] } };

test('a sphere with published models gets its lighting sheet and flood-lit frame from the law', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-published-lighting-'));
  try {
    await mkdir(join(root, 'photometry'));
    await writeFile(join(root, model), JSON.stringify(record));
    await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 150, g: 150, b: 150, alpha: 1 } } }).png().toFile(join(root, 'reference.png'));
    const config = { namespace: 'fixture', publicBase: '/scenes/fixture/', raster: { width: 64, height: 32, bandCount: 8, gutter: 1, poleSize: 16, observations: [] },
      lighting: { presentationSize: 460, limb } };
    const material = await prepareSolidMaterial({ surfaces: [], sourceDirectory: root, publicDirectory: root, outputDirectory: root, config });
    const { frameCount, frameSize, margin, columns, sheetFile, shadowlessFile } = LIGHTING_SHEET, { tile, width, height } = lightingSheetLayout();
    assert.deepEqual([material.lighting?.frameCount, material.lighting?.sheet.url, material.lighting?.shadowless.url, material.lighting?.limb?.referenceSource],
      [frameCount, `/scenes/fixture/${sheetFile}`, `/scenes/fixture/${shadowlessFile}`, 'reference.png']);
    const { data, info } = await sharp(join(root, sheetFile)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [width, height]);
    const alpha = (frame: number, x: number, y: number) => data[((Math.floor(frame / columns) * tile + margin + y) * width + (frame % columns) * tile + margin + x) * 4 + 3];
    const middle = frameSize / 2;
    // The first frame has the Sun behind the body: the disc is night, and in the tile's corner nothing is drawn.
    assert.equal(alpha(0, middle, middle), 255);
    assert.equal(alpha(0, 0, 0), 0);
    // The middle frame has the Sun toward +x near 90 degrees of phase: lit on that side, night on the other.
    const quarter = Math.floor(frameCount / 2);
    assert.equal(alpha(quarter, 24, middle), 255);
    assert.ok(alpha(quarter, frameSize - 48, middle) < 200, `sunward side alpha ${alpha(quarter, frameSize - 48, middle)}`);
    // The last frame and the flood-lit frame have the Sun behind the camera, where the Akimov function is 1 over the whole disc: no overlay at all.
    for (let y = 0; y < frameSize; y += 7) for (let x = 0; x < frameSize; x += 7) assert.equal(alpha(frameCount - 1, x, y), 0);
    const flood = await sharp(join(root, shadowlessFile)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([flood.info.width, flood.info.height], [1024, 1024]);
    assert.ok(flood.data.every((value, index) => index % 4 !== 3 || value === 0));
    await assert.rejects(prepareSolidMaterial({ surfaces: [], sourceDirectory: root, publicDirectory: root, outputDirectory: root, config, radial: true }), /fixture: source\/preparation\/terrestrial\.json lighting is read by nothing: a shape-model body/);
    await assert.rejects(prepareSolidMaterial({ surfaces: [], publicDirectory: root, outputDirectory: root, config }), /needs the source directory/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a lighting recipe names published models or a shared bank, and lays out no frames', () => {
  assert.deepEqual(parseSolidLighting({ presentationSize: 460, limb: { models: limb.models } }), { presentationSize: 460, limb: { models: limb.models } });
  assert.deepEqual(parseSolidLighting({ presentationSize: 460, bank: 'sphere' }), { ...LIGHTING_BANKS.sphere, bank: 'sphere', presentationSize: 460 });
  assert.throws(() => parseSolidLighting({ presentationSize: 460, bank: 'sphere', limb }), /one of the two/);
  assert.throws(() => parseSolidLighting({ presentationSize: 460 }), /one of the two/);
  assert.throws(() => parseSolidLighting({ frameSize: 512, columns: 8, frameCount: 128, logicalSize: 460, limb }), /remove frameSize, frameCount, columns, logicalSize/);
  assert.throws(() => parseSolidLighting({ presentationSize: 460, bank: 'sphere', terminatorWidth: 0.1 }), /remove terminatorWidth/);
  assert.throws(() => parseSolidLighting({ presentationSize: 460, limb: { models: ['a.json'] } }), /three records/);
});
