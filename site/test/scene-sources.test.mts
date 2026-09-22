import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { SCENE_OBJECTS } from '../objects.mts';
import { globSync, readFileSync } from 'node:fs';
import { parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog, isPreparedCluster } from '@cssearth/catalog';
import galaxies from '../../src/objects/local-group/prepared/catalogue.json' with { type: 'json' };
import clusters from '../../src/objects/galaxy-clusters/prepared/catalogue.json' with { type: 'json' };
import { focusSourceDocumentation, overviewSourceDocumentation, sourceDocumentation, systemSourceDocumentation } from '../source-documentation.mts';
import { systemById } from '../object-systems.mts';
const catalogues = [
  { id: 'galaxies', data: parsePreparedGalaxyCatalog(galaxies) },
  { id: 'clusters', data: parsePreparedClusterCatalog(clusters) },
  ...globSync('*/source/nebula.json', { cwd: new URL('../../src/objects/', import.meta.url) }).map(path => ({
    id: 'nebulae', data: parsePreparedNebulaCatalog(JSON.parse(readFileSync(new URL(`../../src/objects/${path}`, import.meta.url), 'utf8'))),
  })),
];

test('every scene links its own existing README at the build revision', () => {
  for (const object of SCENE_OBJECTS) {
    const document = sourceDocumentation(object.id, object.name);
    assert.match(document.href, new RegExp(`^https://github.com/layoutit/cssEarth/blob/[a-f0-9]{40}/src/objects/${object.id}/README\\.md$`, 'u'));
    assert.match(document.label, /^Sources: .+/u);
  }
});

test('overview and catalogue selections link their actual documentation owner', () => {
  assert.match(systemSourceDocumentation(systemById(SCENE_OBJECTS, 'sun')!).href, /\/sun\/README\.md$/u);
  for (const scope of ['milky-way', 'local-group', 'nearby-universe']) {
    assert.ok(overviewSourceDocumentation(scope, scope).href.endsWith(`/src/objects/${scope}/README.md`));
  }
  for (const catalog of catalogues) for (const object of catalog.data.objects) {
    const document = focusSourceDocumentation(object, catalog.id);
    assert.match(document.label, /^Sources(?:: .+)?$/u);
    if (isPreparedCluster(object)) assert.ok(document.href.endsWith('/galaxy-clusters/README.md'));
    else if (object.detailedObjectId) assert.ok(document.href.endsWith(`/src/objects/${object.detailedObjectId}/README.md`));
    else if (catalog.id === 'galaxies') assert.ok(document.href.endsWith('/local-group/README.md'));
    else assert.ok(document.href.endsWith(`/src/objects/${object.id}/README.md`));
  }
});

test('documentation preparation rejects missing owners and paths outside object packages', () => {
  assert.throws(() => sourceDocumentation('missing-scene-document', 'Missing'), /Missing source document/u);
  assert.throws(() => sourceDocumentation('../sun', 'Sun'), /Invalid source document owner/u);
});

test('the footer prepares compact provider credits without changing the README destination', () => {
  assert.equal(sourceDocumentation('bennu', 'Bennu').label, 'Sources: NASA, CSA, USGS, JPL');
  assert.equal(sourceDocumentation('saturn', 'Saturn').label, 'Sources: NASA, ESA, STScI, JPL');
  assert.equal(overviewSourceDocumentation('milky-way', 'Milky Way').label, 'Sources: NASA SVS, OpenSpace');
});

test('the Solar System overview credits its bodies rather than inheriting only the Sun’s maps', () => {
  const overview = systemSourceDocumentation(systemById(SCENE_OBJECTS, 'sun')!);
  const sun = sourceDocumentation('sun', 'Sun');
  assert.equal(overview.href, sun.href);
  assert.notEqual(overview.label, sun.label);
  const providers = overview.label.slice('Sources: '.length).split(', ');
  for (const provider of ['NASA', 'ESA', 'USGS', 'JPL', 'JAXA', 'OpenSpace']) assert.ok(providers.includes(provider), provider);
  assert.equal(providers.filter(provider => provider === 'NASA').length, 1);
  assert.ok(overview.label.length < 180, 'the overview keeps a compact provider summary');
  assert.ok(providers.includes('others'), 'the README retains the remaining credits');
});
