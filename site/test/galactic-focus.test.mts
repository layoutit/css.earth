import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPreparedFocusObjects } from '../../tools/prepare-navigation-destinations.mts';
import { searchObjects } from '../object-search.mts';

test('a source-owned globular cluster is discovered, classified and searched through the shared focus route', async () => {
  const root = await mkdtemp(join(tmpdir(), 'galactic-focus-'));
  try {
    const source = join(root, 'test-cluster/source');
    await mkdir(source, { recursive: true });
    await writeFile(join(source, 'nebula.json'), JSON.stringify({
      schema: 'cssearth-nebula-catalog@1', frame: { referenceFrame: 'sun-icrf', epochJdTt: 2461286.5 },
      sources: [{ id: 'paper', url: 'https://example.org/paper', sha256: 'a'.repeat(64), bytes: 10, citation: 'Test measurement' }],
      objects: [{ id: 'test-cluster', kind: 'globular-cluster', name: 'Test cluster', aliases: ['Cluster alias'],
        positionM: [3.085677581491367e18, 0, 0], skyPosition: { raDeg: 0, decDeg: 0, sourceRef: 'paper' },
        distance: { valuePc: 100, sourceRef: 'paper', method: 'Test distance' },
        classification: { name: 'Globular cluster', basis: 'Integrated stellar light.', sourceRef: 'paper' },
        status: 'confirmed', detailedObjectId: 'test-cluster' }],
    }));
    const [focus, ...others] = await readPreparedFocusObjects(root, 'sun');
    assert.equal(others.length, 0);
    assert.ok(focus);
    assert.equal(focus.classification, 'globular-cluster');
    assert.equal(focus.systemName, 'Milky Way');
    assert.equal(focus.route, '/sun/?focus=test-cluster');
    assert.equal(focus.distance.quantity, 'catalogue');
    const labels = [{ name: focus.name.toLowerCase(), names: focus.searchNames, classification: focus.classification,
      classificationName: 'globular cluster', systemName: focus.systemName.toLowerCase() }];
    assert.equal(searchObjects(labels, 'globular clusters').matches.length, 1);
    assert.equal(searchObjects(labels, 'Cluster alias').matches.length, 1);
    assert.equal(searchObjects(labels, 'nebula').matches.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
