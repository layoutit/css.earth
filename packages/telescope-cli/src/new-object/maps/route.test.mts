import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { BAKE_GROUP, bakeSurfaceMaps } from './route.mts';

test('a star keeps its arrival picture until its own group is baked, so a second group does not stop the first', async () => {
  // One star more than a bake command takes, each opening on a new dataset: its stored arrival picture is of the old one.
  const root = await mkdtemp(join(tmpdir(), 'map-route-')), hosts = Array.from({ length: BAKE_GROUP + 1 }, (_, index) => `star-${index}`), at = (host: string, path: string) => join(root, 'src/objects', host, path);
  try {
    for (const host of hosts) { await mkdir(at(host, 'prepared'), { recursive: true }); await mkdir(at(host, 'source/content'), { recursive: true });
      await writeFile(at(host, 'prepared/arrival-billboard.json'), JSON.stringify({ dataset: 'color' })); await writeFile(at(host, 'source/content/object.json'), JSON.stringify({ datasets: { defaultDataset: 'color-brightness' } })); }
    const pictured = (host: string) => stat(at(host, 'prepared/arrival-billboard.json')).then(() => true, () => false), baked = new Set<string>(), lines: string[] = [], groups: number[] = [];
    const done = await bakeSurfaceMaps(hosts.map(host => ({ host, maps: 1, files: 1, redrawn: true })), { root, progress: line => lines.push(line), run: async args => {
      if (args[0] !== 'packages/bake/cli/prepare-object.mts' || !args.includes('--to')) return true;
      // The bake's first step stops when a star outside the command has lost a prepared file its inventory lists: a star not
      // yet baked must still hold its picture, and one baked earlier lists it no more.
      const group = args.slice(1, args.indexOf('--to')); groups.push(group.length);
      for (const host of hosts) assert.equal(await pictured(host), !group.includes(host) && !baked.has(host), `${host} while ${group[0]!} and its group are baked`);
      for (const host of group) baked.add(host); return true; } });
    assert.equal(done, true); assert.deepEqual(groups, [BAKE_GROUP, 1]);
    assert.match(lines.at(-1)!, new RegExp(`^The default view of ${hosts.length} star\\(s\\) changed\\. Restart the running site, then: node packages/bake/cli/prepare-object\\.mts star-0 .* star-${BAKE_GROUP} --from billboard$`, 'u'));
  } finally { await rm(root, { recursive: true, force: true }); }
});
