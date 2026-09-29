import assert from 'node:assert/strict';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { readAuthoredSources } from '@cssearth/bake/objects/sources';
import { redrawOnlyDecision } from '../build/prepare/prepare-authored.ts';

// A published copy of Iapetus whose recipes match the working tree, so only the feature record's left edge can decide.
async function publishedIapetus(publishedEdge: number) {
  const real = resolve(process.cwd(), 'src/objects/iapetus'), directory = await mkdtemp(resolve(tmpdir(), 'cssearth-redraw-'));
  await symlink(resolve(real, 'source'), resolve(directory, 'source'));
  await copyFile(resolve(real, 'object.json'), resolve(directory, 'object.json'));
  await copyFile(resolve(real, 'inventory.json'), resolve(directory, 'inventory.json'));
  await mkdir(resolve(directory, 'prepared'));
  const { entries } = await readAuthoredSources(directory);
  await writeFile(resolve(directory, 'prepared/authored-preparation.json'), JSON.stringify({ sources: entries.map(entry => entry.reference) }));
  await writeFile(resolve(directory, 'prepared/features.json'), JSON.stringify({ mapLeftEdgeLongitudeDeg: publishedEdge }));
  return directory;
}

test('a redraw carries feature anchors only while the surface map keeps their left edge', async () => {
  const edge = (JSON.parse(await readFile(resolve(process.cwd(), 'src/objects/iapetus/source/presentation/surface-map.json'), 'utf8')) as { mapLeftEdgeLongitudeDeg: number }).mapLeftEdgeLongitudeDeg;
  const same = await publishedIapetus(edge), moved = await publishedIapetus(edge + 180);
  try {
    assert.deepEqual(await redrawOnlyDecision(same), { redraw: true, acceptChanged: [], reason: 'no recipe changed' });
    assert.deepEqual(await redrawOnlyDecision(moved),
      { redraw: false, reason: `the surface map's left edge is ${edge}° E, but the published feature anchors used ${edge + 180}° E` });
  } finally {
    await Promise.all([same, moved].map(directory => rm(directory, { recursive: true, force: true })));
  }
});
