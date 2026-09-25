import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { prepareVolumeAtlases } from './atlas.js';
import type { PreparedCssVolume } from '../../renderers/css/volume/types.js';

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const AXES = ['x', 'y', 'z'] as const;
const TRANSFORM = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,3,4,5,1)';

async function fixture() {
  // Asymmetric colors and varying alpha expose reversed packing, missing gutters,
  // invisible RGB leakage, and accidentally using the default alpha quality.
  const pixels = Buffer.from([211, 70, 12, 0, 90, 170, 240, 31, 40, 90, 120, 93,
    10, 190, 70, 149, 100, 50, 230, 201, 255, 180, 20, 255]);
  const source = await sharp(pixels, { raw: { width: 3, height: 2, channels: 4 } }).png().toBuffer();
  const files = new Map<string, Uint8Array>([['slices/a.png', source], ['slices/b.png', source], ['preview.png', source]]);
  const volume: PreparedCssVolume = {
    schema: 'cssearth-css-volume@1', id: 'fixture',
    frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5, originM: [1, 2, 3],
      localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 10,
      boundsUnits: { min: [-2, -2, -2], max: [2, 2, 2] } },
    anchors: [{ id: 'center', positionUnits: [0, 0, 0] }],
    stacks: AXES.map(axis => ({ axis, leaves: ['b', 'a', 'a'].map((name, index) => ({
      id: `${axis}-${index}`, centerUnits: [index, 0, 0] as const,
      texturePath: `slices/${name}.png`, widthPx: 3, heightPx: 2,
      style: { width: '3px', height: '2px', transform: TRANSFORM,
        backgroundSize: '3px 2px', backgroundPosition: '0px 0px' },
    })) })),
    resources: [...files].map(([path, bytes]) => ({ path, sha256: sha256(bytes), bytes: bytes.byteLength, width: 3, height: 2 })),
    provenance: { source: 'fixture' }, approximation: { method: 'fixture' },
  };
  return { volume, files, pixels };
}

function io(files: Map<string, Uint8Array>) {
  const written = new Map<string, Uint8Array>();
  return {
    prefix: 'atlas/test', written,
    readResource: async (path: string) => {
      const bytes = files.get(path);
      assert.ok(bytes, `Missing fixture resource: ${path}`);
      return bytes;
    },
    writeResource: async (path: string, bytes: Uint8Array) => { written.set(path, bytes); },
  };
}

test('atlas preserves geometry, frame, anchors and non-slice resources; deduplicates packed slices', async () => {
  const { volume, files } = await fixture(), before = structuredClone(volume), options = io(files);
  const result = await prepareVolumeAtlases({ volume, ...options });
  assert.deepEqual(volume, before, 'Input must remain unchanged');
  assert.deepEqual(result.frame, volume.frame);
  assert.deepEqual(result.anchors, volume.anchors);
  assert.deepEqual(result.provenance, volume.provenance);
  assert.deepEqual(result.approximation, volume.approximation);
  assert.deepEqual(result.resources.filter(resource => resource.path === 'preview.png'),
    volume.resources.filter(resource => resource.path === 'preview.png'));
  assert.equal(result.resources.length, 4);
  assert.equal(options.written.size, 3);
  for (const [axisIndex, stack] of result.stacks.entries()) {
    assert.equal(stack.leaves.length, 3);
    for (const [index, leaf] of stack.leaves.entries()) {
      const original = volume.stacks[axisIndex]!.leaves[index]!;
      assert.deepEqual(leaf, { ...original, texturePath: `atlas/test/${stack.axis}.webp`,
        style: { ...original.style, backgroundSize: '14px 6px', backgroundPosition: index === 0 ? '-9px -2px' : '-2px -2px' } });
    }
    const resource = result.resources.find(item => item.path === `atlas/test/${stack.axis}.webp`)!;
    const bytes = options.written.get(resource.path)!;
    assert.equal(resource.width, 14);
    assert.equal(resource.height, 6);
    assert.equal(resource.bytes, bytes.byteLength);
    assert.equal(resource.sha256, sha256(bytes));
    const decoded = await sharp(bytes).metadata();
    assert.equal(decoded.format, 'webp');
    assert.equal(decoded.width, 14);
    assert.equal(decoded.height, 6);
  }
});

test('encoded atlas equals Q80/A80 reference with two-pixel clamped gutters and transparent RGB cleared', async () => {
  const { volume, files, pixels } = await fixture(), options = io(files);
  await prepareVolumeAtlases({ volume, ...options });
  // Independently assemble the expected two 7x6 padded cells from their rows.
  const paddedRows: Buffer[] = [];
  for (const row of [0, 0, 0, 1, 1, 1]) {
    const cell = Buffer.concat([0, 0, 0, 1, 2, 2, 2].map(column => {
      const pixel = Buffer.from(pixels.subarray((row * 3 + column) * 4, (row * 3 + column + 1) * 4));
      if (pixel[3] === 0) pixel.fill(0);
      return pixel;
    }));
    paddedRows.push(Buffer.concat([cell, cell]));
  }
  const raw = Buffer.concat(paddedRows);
  const expected = await sharp(raw, { raw: { width: 14, height: 6, channels: 4 } })
    .webp({ quality: 80, alphaQuality: 80, effort: 4 }).toBuffer();
  for (const bytes of options.written.values()) assert.deepEqual(Buffer.from(bytes), expected);
  const defaultAlpha = await sharp(raw, { raw: { width: 14, height: 6, channels: 4 } })
    .webp({ quality: 80, effort: 4 }).toBuffer();
  assert.notDeepEqual(expected, defaultAlpha, 'Fixture must detect removal of alphaQuality:80');
});

test('atlas output and metadata are reproducible independent of resource order', async () => {
  const { volume, files } = await fixture(), first = io(files), second = io(files);
  const a = await prepareVolumeAtlases({ volume, ...first });
  const b = await prepareVolumeAtlases({ volume: { ...volume, resources: [...volume.resources].reverse() }, ...second });
  assert.deepEqual(a, b);
  assert.deepEqual(first.written, second.written);
});

test('rejects corrupt source bytes before writing an atlas', async () => {
  const { volume, files } = await fixture();
  files.set('slices/a.png', Buffer.from('corrupt'));
  const options = io(files);
  await assert.rejects(prepareVolumeAtlases({ volume, ...options }), /hash mismatch/);
  assert.equal(options.written.size, 0);
});

test('rejects actual image dimensions that disagree with declared slice geometry', async () => {
  const { volume, files } = await fixture();
  const bytes = await sharp({ create: { width: 4, height: 2, channels: 4, background: '#ff0000' } }).png().toBuffer();
  files.set('slices/a.png', bytes);
  const resources = volume.resources.map(resource => resource.path === 'slices/a.png'
    ? { ...resource, bytes: bytes.length, sha256: sha256(bytes) } : resource);
  await assert.rejects(prepareVolumeAtlases({ volume: { ...volume, resources }, ...io(files) }), /dimensions mismatch/);
});

test('rejects already-atlased geometry and unsafe output prefixes', async () => {
  const { volume, files } = await fixture(), options = io(files);
  const result = await prepareVolumeAtlases({ volume, ...options });
  await assert.rejects(prepareVolumeAtlases({ volume: result, ...io(options.written) }), /x slice x-0 to draw its whole 14×6 texture/);
  await assert.rejects(prepareVolumeAtlases({ volume, ...io(files), prefix: '../outside' }), /Unsafe/);
  const stacks = volume.stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(leaf => ({
    ...leaf, style: { ...leaf.style, width: '6px' },
  })) }));
  await assert.rejects(prepareVolumeAtlases({ volume: { ...volume, stacks }, ...io(files) }), /box 6px 2px, background-size 3px 2px/);
});

test('an atlas keeps each slice at the texel density its box was compiled at', async () => {
  // A slice compiled at two texels per CSS pixel draws its 3x2 texture across a 1.5x1 px box; its atlas sampling
  // must stay at that density, or the leaf would show a quarter of its tile.
  const { volume, files } = await fixture(), options = io(files);
  const dense = { ...volume, stacks: volume.stacks.map(stack => ({ ...stack, leaves: stack.leaves.map(leaf => ({
    ...leaf, style: { ...leaf.style, width: '1.5px', height: '1px', backgroundSize: '1.5px 1px' },
  })) })) };
  const result = await prepareVolumeAtlases({ volume: dense, ...options });
  for (const [axisIndex, stack] of result.stacks.entries()) for (const [index, leaf] of stack.leaves.entries()) {
    const original = dense.stacks[axisIndex]!.leaves[index]!;
    assert.deepEqual(leaf, { ...original, texturePath: `atlas/test/${stack.axis}.webp`,
      style: { ...original.style, backgroundSize: '7px 3px', backgroundPosition: index === 0 ? '-4.5px -1px' : '-1px -1px' } });
  }
  // The same pixels are packed whatever the leaf's box.
  const sparse = io(files);
  await prepareVolumeAtlases({ volume, ...sparse });
  assert.deepEqual(options.written, sparse.written);
});
