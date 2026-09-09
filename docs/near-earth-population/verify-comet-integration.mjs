import assert from 'node:assert/strict';
import {readFile, writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {OBJECTS} from '../../site/objects.mjs';

const base = 'bd265cf3a091c4ef17e9be76dfeb23410364884f';
const prior = 'b02fbfce8';
const added = ['ivar', 'toro', 'cerberus', 'tantalus'];
const git = (revision, path) => execFileSync('git', ['show', `${revision}:${path}`], {maxBuffer: 64 * 1024 * 1024});
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const withoutMarkers = ({heliocentricView, ...rest}) => rest;
const evidence = [];
for (const id of [...added, 'comet-2p', 'comet-209p']) {
  const reference = added.includes(id) ? prior : base;
  const prefix = `src/planets/${id}/`;
  const paths = execFileSync('git', ['ls-tree', '-r', '--name-only', reference, '--', prefix], {encoding: 'utf8'}).trim().split('\n');
  const preserved = [];
  for (const path of paths) {
    if (['object.json', 'prepared/page.json', 'prepared/runtime.json', 'prepared/world-context.json'].some(suffix => path === prefix + suffix)) continue;
    const bytes = await readFile(path);
    assert.ok(bytes.equals(git(reference, path)), `${id}: scientific/source payload changed: ${path}`);
    preserved.push({path: path.slice(prefix.length), sha256: hash(bytes)});
  }
  const runtimePath = prefix + 'prepared/runtime.json';
  assert.deepEqual(withoutMarkers(JSON.parse(await readFile(runtimePath))), withoutMarkers(JSON.parse(git(reference, runtimePath))));
  evidence.push({id, reference, preserved, runtimeExceptHeliocentricView: 'identical'});
}
assert.equal(OBJECTS.length, 412);
assert.equal(OBJECTS.filter(object => object.classification === 'asteroid').length, 291);
const universe = JSON.parse(await readFile('src/planets/sun/source/navigation/universe.json'));
assert.equal(universe.bodies.length, 411);
const sourceIds = universe.bodies.map(body => body.id);
assert.equal(new Set(sourceIds).size, sourceIds.length);
assert.deepEqual(new Set(sourceIds), new Set(OBJECTS.filter(object => object.id !== 'sun').map(object => object.id)));
const navigation = JSON.parse(await readFile('docs/near-earth-population/navigation-evidence.json'));
assert.equal(navigation.base, base);
assert.ok(navigation.atlases.every(atlas => atlas.preservedMarkers === 408));
await writeFile('docs/near-earth-population/comet-integration.json', JSON.stringify({
  base, prior, objects: OBJECTS.length, asteroids: 291, sunDestinations: sourceIds.length,
  navigation, evidence,
  scope: 'Incoming Encke and LINEAR scientific packages retained; only shared marker/context/page/minimap metadata refreshed. No geometry, scalar, atlas or presentation rebake. Existing browser images and drag remain bound to their recorded prior revision.'
}, null, 2) + '\n');
console.log('Comet integration: 412 objects, 291 asteroids, 411 destinations; four asteroid and two comet scientific packages preserved.');
