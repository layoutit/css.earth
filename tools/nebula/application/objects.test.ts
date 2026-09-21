import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { sanitizeVolumeProvenance } from './volume-provenance.ts';
import { applicationDeliveryKind, installedDeliveryMatchesRecipe } from './delivery-identity.ts';

// Bundled for execution (test-preparation.mts, like every other `.test.ts` here), so `import.meta.dirname`
// would resolve against the bundle's own output location, not this file's; the repo root is the actual cwd instead.
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

test('application preparation dispatches only delivery schemas owned by the nebula pipeline', () => {
  assert.equal(applicationDeliveryKind('delivery.json', { schema: 'cssearth-nebula-delivery@1' }), 'nebula');
  assert.equal(applicationDeliveryKind('compact-delivery.json', { schema: 'cssearth-compact-density-delivery@1' }), 'compact-density');
  assert.equal(applicationDeliveryKind('delivery.json', { schema: 'cssearth-density-volume-lens-bank-source@1' }), null);
  assert.equal(applicationDeliveryKind('delivery.json', {}), null);
  assert.throws(() => applicationDeliveryKind('compact-delivery.json', { schema: 'foreign@1' }), /Unsupported compact density delivery schema/);
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
