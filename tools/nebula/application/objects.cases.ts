import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import sharp from 'sharp';
import test from 'node:test';
import ts from 'typescript';
import { sanitizeVolumeProvenance } from './volume-provenance.ts';
import { installedDeliveryMatchesRecipe } from './delivery-identity.ts';
import { prepareNebulaObject, type NebulaResearchBackend } from './objects.ts';
import { sha256 } from '../../../src/platform/sha256.mts';
import { createRenderElementBudget } from '@cssearth/volume-core/contracts/render-element-budget';
import type { CompilerBakeResult } from '@cssearth/volume-core/contracts/compiler-bake';
import type { PreparedCssVolume } from '../../../src/renderers/css/volume/types.js';
import { CSS_COMPILER_RENDER_BUDGET } from '../../../src/renderers/css/volume/compiler-render-budget.js';
import { validatePreparedVolumeLenses } from '../../../src/renderers/css/volume/prepared-volume-lenses.js';
import { assertCompilerDeliveryElementBudget } from './element-budget.ts';

// Bundled by objects.test.ts, so import.meta.dirname identifies the temporary bundle.
// The repository root remains the test process's actual working directory.
const root = process.cwd();

test('sanitizeVolumeProvenance replaces the process-pid staging directory with a stable placeholder', () => {
  const volume = { provenance: { layout: 'x', sourceVolume: { path: 'src/objects/m1/.prepared-59471/compact/hubble-optical/lenses/hubble-optical/volume.json', sha256: 'a'.repeat(64) } } };
  const sanitized = sanitizeVolumeProvenance(volume);
  assert.equal(sanitized.provenance.sourceVolume.path,
    'src/objects/m1/.prepared-compact/compact/hubble-optical/lenses/hubble-optical/volume.json');
  assert.doesNotMatch(sanitized.provenance.sourceVolume.path, /\.prepared-\d+/);
  // A different process's bake must record the identical, pid-independent path.
  const otherPid = { provenance: { layout: 'x', sourceVolume: { path: 'src/objects/m1/.prepared-1/compact/hubble-optical/lenses/hubble-optical/volume.json', sha256: 'a'.repeat(64) } } };
  assert.deepEqual(sanitizeVolumeProvenance(otherPid), sanitized);
});

test('sanitizeVolumeProvenance leaves provenance without a staging path untouched', () => {
  const noProvenance = { provenance: null };
  assert.equal(sanitizeVolumeProvenance(noProvenance), noProvenance);
  const stablePath = { provenance: { sourceVolume: { path: 'src/objects/m1/prepared/hubble-optical/volume.json', sha256: 'a'.repeat(64) } } };
  assert.equal(sanitizeVolumeProvenance(stablePath), stablePath);
  const noSourceVolume = { provenance: { layout: 'x' } };
  assert.equal(sanitizeVolumeProvenance(noSourceVolume), noSourceVolume);
  // Only a whole `.prepared-<pid>` path segment is the staging directory.
  const lookalike = { provenance: { sourceVolume: { path: 'src/objects/m1/data.prepared-7/volume.json', sha256: 'a'.repeat(64) } } };
  assert.equal(sanitizeVolumeProvenance(lookalike), lookalike);
});

test('consumer preparation reuses a byte-verified delivery across implementation changes but not recipe changes', () => {
  const receipt = { recipeSha256: 'a'.repeat(64), implementationSha256: 'b'.repeat(64) };
  assert.equal(installedDeliveryMatchesRecipe(receipt, 'a'.repeat(64)), true);
  assert.equal(installedDeliveryMatchesRecipe({ ...receipt, implementationSha256: 'c'.repeat(64) }, 'a'.repeat(64)), true);
  assert.equal(installedDeliveryMatchesRecipe(receipt, 'd'.repeat(64)), false);
});

test('every volume the nebula delivery validates is sanitized, and an explicit bake records the sanitizer', async () => {
  const path = 'tools/nebula/application/objects.ts', source = await readFile(resolve(root, path), 'utf8');
  const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  let validated = 0, sanitized = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'validatePreparedCssVolume') {
      validated++;
      const parent = node.parent;
      if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === 'sanitizeVolumeProvenance' &&
        parent.arguments.length === 1 && parent.arguments[0] === node) sanitized++;
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  assert.ok(validated > 0, 'the delivery validates at least one prepared volume');
  assert.equal(sanitized, validated, 'each validated volume passes straight through sanitizeVolumeProvenance');
  // An explicit bake records these owners. `--if-missing` is a consumer path: it verifies the installed byte
  // closure and recipe without silently rebaking because unrelated runtime code changed.
  assert.match(source, /'tools\/nebula\/application\/volume-provenance\.ts'/);
  assert.match(source, /installed\(directory,sha256\(recipeBytes\)\)/);
  assert.doesNotMatch(source, /installed\(directory,sha256\(recipeBytes\),implementationSha256\)/);
});

test('a prepared m1 lens bank, if baked locally, records no process-pid staging directory', async () => {
  const path = resolve(root, 'src/objects/m1/prepared/lenses.json');
  let bytes: string;
  try { bytes = await readFile(path, 'utf8'); }
  catch (error) { if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return; throw error; }
  assert.doesNotMatch(bytes, /\.prepared-\d+(?=[\\/])/, 'A bake must never record its own staging directory name in committed-shaped provenance.');
});

test('the real installer rejects post-compiler field stars before replacing the delivered package', async t => {
  await mkdir(resolve(root, 'output'), { recursive: true });
  const directory = await mkdtemp(resolve(root, 'output/nebula-budget-install-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const save = async (path: string, value: unknown) => {
    const bytes = JSON.stringify(value) + '\n', target = resolve(directory, path);
    await writeFile(target, bytes);
    return { path: relative(root, target), sha256: sha256(bytes) };
  };
  await mkdir(resolve(directory, 'source'));
  await mkdir(resolve(directory, 'prepared'));
  const request = await save('request.json', {});
  const frame: CompilerBakeResult['frame'] = { referenceFrame: 'lab-sky-west-north-toward', epochJdTt: 2451545,
    originM: [0, 0, 0], localToReferenceXyzw: [0, 0, 0, 1], metersPerUnit: 1,
    boundsUnits: { min: [-1, -1, -1], max: [1, 1, 1] } };
  const texture = await sharp(Buffer.from([255, 255, 255, 128]), { raw: { width: 1, height: 1, channels: 4 } }).png().toBuffer();
  const transforms = {
    x: 'matrix3d(100,0,0,0,0,0,-100,0,0,1,0,0,-50,0,50,1)',
    y: 'matrix3d(0,100,0,0,0,0,-100,0,1,0,0,0,0,-50,50,1)',
    z: 'matrix3d(0,100,0,0,-100,0,0,0,0,0,1,0,50,-50,0,1)',
  };
  const axes = ['x', 'y', 'z'] as const;
  for (const axis of axes) await writeFile(resolve(directory, `${axis}.png`), texture);
  const volume: PreparedCssVolume = { schema: 'cssearth-css-volume@1', id: 'fixture', frame, anchors: [],
    provenance: {}, approximation: {}, stacks: axes.map(axis => ({ axis, leaves: [{ id: `${axis}-0`,
      centerUnits: [0, 0, 0], texturePath: `${axis}.png`, widthPx: 1, heightPx: 1,
      style: { width: '1px', height: '1px', transform: transforms[axis], backgroundSize: '1px 1px', backgroundPosition: '0px 0px' } }] })),
    resources: axes.map(axis => ({ path: `${axis}.png`, sha256: sha256(texture), bytes: texture.length, width: 1, height: 1 })) };
  const volumePin = await save('volume.json', volume);
  // Explicit synthetic fixture row: the real catalogue-field owner adds it after compiler admission.
  const fieldStars = await save('field.json', { schema: 'cssearth-gaia-nebula-field@1', id: 'budget-fixture', coordinateEpochJulianYear: 2016,
    selection: { centerIcrsDegrees: [0, 0], distancePc: 1, outerRadiusPc: 1, featherStartPc: .5, maximumStars: 1,
      retainIds: [], limitingMagnitude: 20, fadeMagnitude: 1, referenceMagnitude: 10, referenceDiameterPx: 1, referenceFocalPixels: 100 },
    stars: [{ sourceId: '1234567890123', raDeg: 0, decDeg: 0, distancePc: 1, distanceLowerPc: .9, distanceUpperPc: 1.1,
      pmRaMasYr: null, pmDecMasYr: null, photGMeanMag: 10, bpRp: 1, parallaxMas: 1000, parallaxErrorMas: 1, ruwe: 1 }] });
  await save('source/delivery.json', { schema: 'cssearth-nebula-delivery@1', id: 'budget-fixture', method: 'compiler',
    request, inputPins: [], sky: { centerIcrsDegrees: [0, 0], distancePc: 1, imageRotationDegrees: 0, arcsecPerUnit: 1 },
    sourceUrl: 'https://example.org/fixture', description: 'Synthetic installer regression', defaultLens: 'first',
    framingRadiusUnits: 1, acceptedLabResult: 'fixture', attachedTo: 'sun', fieldStars });
  const scene: CompilerBakeResult = { schema: 'cssearth-compiler-bake@1', id: 'fixture', fieldIdentity: 'a'.repeat(64), frame,
    boundsArcsec: { min: [-1, -1, -1], max: [1, 1, 1] }, skyBoundsArcsec: { min: [-1, -1], max: [1, 1] }, spanArcsec: 2, sourceImage: { width: 512, height: 512 },
    coordinates: { axes: ['west', 'north', 'away'], localOriginArcsec: [0, 0, 0], earthView: 'observer-at-negative-z-looking-away' },
    neutral: volumePin, lenses: [{ id: 'first', label: 'First', volume: volumePin,
      coverage: { positiveAlphaTexels: 3, recoloredTexels: 3, outsideImageTexels: 0 } }], stars: [], alphaSha256: 'b'.repeat(64),
    sampling: { imageWidth: 512, samplesPerSlab: 4, sliceCounts: { x: 1, y: 1, z: 1 },
      renderBudget: createRenderElementBudget(CSS_COMPILER_RENDER_BUDGET, 0, 3) } };
  const backend: NebulaResearchBackend = {
    async compiler() { return { id: scene.id, scene, sources: [{ id: 'first', label: 'First', credit: 'Fixture', page: 'https://example.org/fixture' }] }; },
    async symmetry() { throw new Error('Compiler installer must not call symmetry.'); },
  };
  await writeFile(resolve(directory, 'object.json'), 'existing-descriptor\n');
  await writeFile(resolve(directory, 'prepared/lenses.json'), 'existing-bank\n');
  await assert.rejects(prepareNebulaObject(root, directory, false, backend), /star reservation/);
  assert.equal(await readFile(resolve(directory, 'object.json'), 'utf8'), 'existing-descriptor\n');
  assert.equal(await readFile(resolve(directory, 'prepared/lenses.json'), 'utf8'), 'existing-bank\n');
  // Reserving the actual final field count admits the same prepared geometry and real packaging operations.
  scene.sampling.renderBudget = createRenderElementBudget(CSS_COMPILER_RENDER_BUDGET, 1, 3);
  const result = await prepareNebulaObject(root, directory, false, backend);
  assert.equal(result.status, 'prepared');
  const parsed: unknown = JSON.parse(await readFile(resolve(directory, 'prepared/lenses.json'), 'utf8'));
  assert.ok(parsed && typeof parsed === 'object' && 'data' in parsed);
  const data = validatePreparedVolumeLenses(parsed.data);
  assert.equal(data.lenses[0]!.stars.points.length, 1);
  assert.equal(data.lenses[0]!.volume.impostors?.views.length, 26);
  assert.ok(data.lenses[0]!.volume.stacks.every(stack => stack.leaves[0]!.texturePath.includes('/atlases/')));
  assert.equal(assertCompilerDeliveryElementBudget(scene.sampling, data)?.totalElements, 56);
  const receipt: unknown = JSON.parse(await readFile(resolve(directory, 'prepared/delivery.json'), 'utf8'));
  assert.ok(receipt && typeof receipt === 'object' && 'renderElements' in receipt);
  assert.deepEqual(receipt.renderElements, { starCount: 1, slabCount: 3, impostorCount: 26, totalElements: 56 });
});
