import { sourceTest } from '@cssearth/objects/node/source-test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { parseSolidLighting, prepareSolidMaterial } from '@cssearth/bake/objects/layers/terrestrial';
const test = sourceTest();

const model = 'photometry/fixture-akimov.json', models: [string, string, string] = [model, model, model], limb = { models, reference: 'reference.png' };
// Rhea at 599 nm, Filacchione et al. (2022) Table 6: the Akimov disk function with a quadratic phase curve.
const record = { schema: 'cssearth-photometric-model@1', id: 'fixture-akimov', instrument: 'fixture', filter: 'fixture', quantity: 'radiance-factor',
  model: { family: 'separable', disk: { family: 'akimov' }, phase: { family: 'quadratic', constant: 0.610461, perDegree: -0.00352956, perDegreeSquared: -1.0071e-06, heldBeyondDegrees: 120 } },
  fit: { phaseDegrees: [10, 120], incidenceDegrees: [0, 70], emissionDegrees: [0, 70] } };

test('a sphere with published models gets its lighting atlas from the law, in the authored atlas layout', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cssearth-published-lighting-'));
  try {
    await mkdir(join(root, 'photometry'));
    await writeFile(join(root, model), JSON.stringify(record));
    await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 150, g: 150, b: 150, alpha: 1 } } }).png().toFile(join(root, 'reference.png'));
    const size = 32, config = { namespace: 'fixture', publicBase: '/scenes/fixture/', raster: { width: 64, height: 32, bandCount: 8, gutter: 1, poleSize: 16, observations: [] },
      lighting: { frameSize: size, columns: 2, frameCount: 4, logicalSize: size, limb } };
    const material = await prepareSolidMaterial({ surfaces: [], sourceDirectory: root, publicDirectory: root, outputDirectory: root, config });
    assert.deepEqual([material.lighting?.columns, material.lighting?.rowCount, material.lighting?.frameCount], [2, 2, 4]);
    const { data, info } = await sharp(join(root, 'fixture-lighting.webp')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.deepEqual([info.width, info.height], [2 * size, 2 * size]);
    const alpha = (frame: number, x: number, y: number) => data[(((frame >> 1) * size + y) * info.width + (frame & 1) * size + x) * 4 + 3];
    const middle = size / 2;
    // The last frame is flood light, where the Akimov function is 1 over the whole disc: no overlay at all.
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) assert.equal(alpha(3, x, y), 0);
    // The first frame has the Sun behind the body: the disc is night, and outside it nothing is drawn.
    assert.equal(alpha(0, middle, middle), 255);
    assert.equal(alpha(0, 0, 0), 0);
    // The third frame has the Sun toward +x at 70.5 degrees phase: lit on that side, night on the other.
    assert.equal(alpha(2, 3, middle), 255);
    assert.ok(alpha(2, size - 6, middle) < 200, `sunward side alpha ${alpha(2, size - 6, middle)}`);
    await assert.rejects(prepareSolidMaterial({ surfaces: [], sourceDirectory: root, publicDirectory: root, outputDirectory: root, config, radial: true }), /fixture: source\/preparation\/terrestrial\.json lighting is read by nothing: a shape-model body/);
    await assert.rejects(prepareSolidMaterial({ surfaces: [], publicDirectory: root, outputDirectory: root, config }), /needs the source directory/);
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('a lighting recipe states published models or the authored sphere law, never both', () => {
  const frames = { frameSize: 512, columns: 8, frameCount: 128, logicalSize: 460 };
  const authored = { terminatorWidth: 0.1, directionalAmbient: 0.05, fullPhaseAmbient: 0.35, fullPhaseDiffuse: 0.65, maximumOpacity: 0.95 };
  assert.deepEqual(parseSolidLighting({ ...frames, ...authored }), { ...frames, ...authored });
  assert.deepEqual(parseSolidLighting({ ...frames, limb: { models: limb.models } }), { ...frames, limb: { models: limb.models } });
  assert.throws(() => parseSolidLighting({ ...frames, ...authored, limb }), /remove terminatorWidth, directionalAmbient, fullPhaseAmbient, fullPhaseDiffuse, maximumOpacity/);
  assert.throws(() => parseSolidLighting({ ...frames }), /terminatorWidth/);
  assert.throws(() => parseSolidLighting({ ...frames, limb: { models: ['a.json'] } }), /three records/);
});
