import assert from 'node:assert/strict';
import { readFile, mkdir, mkdtemp, rm, writeFile, cp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parseFieldRecipe } from './recipe.mts';
import { sha256 } from '../../src/platform/sha256.mts';

const input: unknown = JSON.parse(await readFile(new URL('../../src/objects/nearby-universe/source/preparation/field.json', import.meta.url), 'utf8'));
const recipe = parseFieldRecipe(input);

test('field distance bounds must be increasing', () => {
  assert.throws(() => parseFieldRecipe({ schema: 'cssearth-galaxy-field-recipe@1', ...recipe, minimumDistanceMpc: 200, maximumDistanceMpc: 3 }), /below maximum/);
  assert.throws(() => parseFieldRecipe({ schema: 'cssearth-galaxy-field-recipe@1', ...recipe, minimumDistanceMpc: 3, maximumDistanceMpc: 3 }), /below maximum/);
  assert.equal(recipe.minimumDistanceMpc, 3);
  assert.equal(recipe.maximumDistanceMpc, 200);
});

test('cloud texture needs at least two pixels to normalize its radial coordinates', () => {
  assert.throws(() => parseFieldRecipe({ schema: 'cssearth-galaxy-field-recipe@1', ...recipe, texture: { ...recipe.texture, size: 1 } }), /at least 2/);
  assert.equal(parseFieldRecipe({ schema: 'cssearth-galaxy-field-recipe@1', ...recipe, texture: { ...recipe.texture, size: 2 } }).texture.size, 2);
});

test('the galaxy field pins the authored frame contract, not rendered world geometry', async () => {
  const manifest = JSON.parse(await readFile('src/objects/nearby-universe/source/manifest.json', 'utf8'));
  const navigation = manifest.documents.find((entry: { id: string }) => entry.id === 'navigation-frame');
  assert.equal(navigation.path, 'src/objects/sun/source/navigation/universe.json');
  const frame = await readFile(navigation.path);
  assert.equal(frame.length, navigation.expectedBytes);
  assert.equal(sha256(frame), navigation.expectedSha256);
  assert.equal(manifest.generatedIntermediates.length, 0);
  const preparer = await readFile(new URL('./prepare-points.mts', import.meta.url), 'utf8');
  assert.match(preparer, /sun\/source\/navigation\/universe\.json/u);
  assert.doesNotMatch(preparer, /sun\/prepared\/world-context\.json/u);
});


test('a changed source manifest pin fails before any field output is replaced', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'galaxy-field-pins-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const base = resolve(root, 'src/objects/nearby-universe');
  await mkdir(resolve(base, 'source'), { recursive: true });
  await mkdir(resolve(base, 'prepared'));
  const path = 'src/objects/nearby-universe/source/evidence.json';
  await writeFile(resolve(root, path), '{}');
  await writeFile(resolve(base, 'source/manifest.json'), JSON.stringify({ schema: 'cssearth-volume-source-manifest@1', pathBase: 'repository', inputs: [], documents: [{ path, expectedBytes: 2, expectedSha256: '0'.repeat(64), sourceBinding: { kind: 'local', reason: 'Pin mutation fixture.' } }], generatedIntermediates: [] }));
  const outputs = ['prepared/points.json', 'prepared/cloud.webp', 'object.json', 'prepared/manifest.json'];
  for (const output of outputs) await writeFile(resolve(base, output), 'previous output');
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./prepare-points.mts', import.meta.url))], { cwd: root, encoding: 'utf8' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Changed source document/);
  for (const output of outputs) assert.equal(await readFile(resolve(base, output), 'utf8'), 'previous output');
});

test('the field bake replaces stale generated files and restores missing receipts', async t => {
  const root=await mkdtemp(resolve(tmpdir(),'galaxy-field-repair-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const base='src/objects/nearby-universe';
  await mkdir(resolve(root,base,'prepared'),{recursive:true});
  await cp(resolve(base,'source'),resolve(root,base,'source'),{recursive:true});
  await mkdir(resolve(root,'.local/galaxy-field'),{recursive:true});
  await cp('.local/galaxy-field/sources',resolve(root,'.local/galaxy-field/sources'),{recursive:true});
  await mkdir(resolve(root,'src/objects/sun/source/navigation'),{recursive:true});
  await cp('src/objects/sun/source/navigation/universe.json',resolve(root,'src/objects/sun/source/navigation/universe.json'));
  await writeFile(resolve(root,base,'prepared/points.json'),'stale generation');
  await writeFile(resolve(root,base,'prepared/cloud.webp'),'stale generation');
  const result=spawnSync(process.execPath,[fileURLToPath(new URL('./prepare-points.mts',import.meta.url))],{cwd:root,encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/POINTS PREPARED: 1800/);
  for(const path of ['prepared/points.json','prepared/cloud.webp','prepared/manifest.json','object.json']) {
    assert.deepEqual(await readFile(resolve(root,base,path)),await readFile(resolve(base,path)));
  }
});
