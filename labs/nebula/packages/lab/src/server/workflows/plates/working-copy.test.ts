import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { discardWorkingCopy, editWorkingCopy, readRecipeState, readSetArgument, recipeChanges, saveWorkingCopy, trackedRecipePath, workingRecipePath, workingRecipeText } from './working-copy.ts';

/** A recipe spelled the way tracked recipes are, including a number JSON.stringify would respell. */
const RECIPE = '{\n  "geometry": {\n    "rings": { "plates": [ { "id": "disc", "radiusArcsec": 250, "tiltDeg": 23 } ] },\n    "floor": 1e-06\n  },\n  "bake": { "maxFacePixels": 2048 }\n}\n';
async function fixture() {
  const root = await mkdtemp(join(tmpdir(), 'lab-working-copy-'));
  await mkdir(resolve(root, 'src/objects/demo/source'), { recursive: true });
  await writeFile(resolve(root, 'src/objects/demo/source/recipe.json'), RECIPE);
  return { root, tracked: () => readFileSync(trackedRecipePath(root, 'demo'), 'utf8'), done: () => rm(root, { recursive: true, force: true }) };
}

test('an edit writes the working copy and leaves the tracked recipe byte for byte', async () => {
  const { root, tracked, done } = await fixture();
  try {
    const state = await editWorkingCopy(root, 'demo', [{ path: 'geometry.rings.plates.0.tiltDeg', value: 30 }]);
    assert.equal(tracked(), RECIPE);
    assert.ok(existsSync(workingRecipePath(root, 'demo')));
    assert.deepEqual(state.changes, [{ path: 'geometry.rings.plates.0.tiltDeg', from: 23, to: 30 }]);
    assert.equal(state.working, true);
    // Drafts and the viewer read the working copy.
    assert.equal((JSON.parse(await workingRecipeText(root, 'demo')) as { geometry: { rings: { plates: { tiltDeg: number }[] } } }).geometry.rings.plates[0]!.tiltDeg, 30);
  } finally { await done(); }
});

test('Save writes exactly the working copy\'s changes into the tracked recipe and removes the working copy', async () => {
  const { root, tracked, done } = await fixture();
  try {
    await editWorkingCopy(root, 'demo', [{ path: 'geometry.rings.plates.0.tiltDeg', value: 30 }]);
    await editWorkingCopy(root, 'demo', [{ path: 'geometry.rings.plates.0.radiusArcsec', value: 260.5 }]);
    const saved = await saveWorkingCopy(root, 'demo');
    assert.equal(saved.length, 2);
    assert.equal(tracked(), RECIPE.replace('"radiusArcsec": 250', '"radiusArcsec": 260.5').replace('"tiltDeg": 23', '"tiltDeg": 30'));
    assert.ok(tracked().includes('1e-06'), 'only the edited numbers are respelled');
    assert.ok(!existsSync(workingRecipePath(root, 'demo')));
    assert.deepEqual((await readRecipeState(root, 'demo')).changes, []);
  } finally { await done(); }
});

test('Discard drops the working copy and leaves the tracked recipe as it was', async () => {
  const { root, tracked, done } = await fixture();
  try {
    await editWorkingCopy(root, 'demo', [{ path: 'geometry.rings.plates.0.tiltDeg', value: 30 }]);
    assert.equal((await discardWorkingCopy(root, 'demo')).length, 1);
    assert.equal(tracked(), RECIPE);
    assert.ok(!existsSync(workingRecipePath(root, 'demo')));
    const state = await readRecipeState(root, 'demo');
    assert.equal(state.working, false);
    assert.deepEqual(await saveWorkingCopy(root, 'demo'), []);
    assert.equal(tracked(), RECIPE);
  } finally { await done(); }
});

test('an edit back to the tracked value leaves no working copy (Undo and the resets act on the working copy)', async () => {
  const { root, done } = await fixture();
  try {
    await editWorkingCopy(root, 'demo', [{ path: 'geometry.rings.plates.0.tiltDeg', value: 30 }]);
    const state = await editWorkingCopy(root, 'demo', [{ path: 'geometry.rings.plates.0.tiltDeg', value: 23 }]);
    assert.deepEqual(state.changes, []);
    assert.ok(!existsSync(workingRecipePath(root, 'demo')));
  } finally { await done(); }
});

test('a change the tracked recipe takes meanwhile survives a Save', async () => {
  const { root, tracked, done } = await fixture();
  try {
    await editWorkingCopy(root, 'demo', [{ path: 'geometry.rings.plates.0.tiltDeg', value: 30 }]);
    await writeFile(trackedRecipePath(root, 'demo'), RECIPE.replace('2048', '4096'));
    assert.deepEqual((await readRecipeState(root, 'demo')).changes.map(change => change.path), ['geometry.rings.plates.0.tiltDeg']);
    await saveWorkingCopy(root, 'demo');
    assert.equal(tracked(), RECIPE.replace('2048', '4096').replace('"tiltDeg": 23', '"tiltDeg": 30'));
  } finally { await done(); }
});

test('changes are numbers only; the CLI\'s --set reads path=value', () => {
  assert.throws(() => recipeChanges({ a: 'x' }, { a: 'y' }), /beyond its numbers/);
  assert.deepEqual(readSetArgument('geometry.rings.plates.0.tiltDeg=31.5'), { path: 'geometry.rings.plates.0.tiltDeg', value: 31.5 });
  assert.throws(() => readSetArgument('geometry.tilt=abc'), /--set/);
});
