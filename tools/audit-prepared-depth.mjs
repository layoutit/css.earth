// Inspect the registry's real source/rendered contracts without writing banks.
// Pair this mathematical oracle with native browser screenshots and traces.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { OBJECTS } from '../site/objects.mjs';
import { preparePresentationBindings } from './prepared-presentation-bindings.mjs';
import { partitionSurface, restoreDepthSource } from './prepared-depth-partitions.mjs';
import { verifyRayOrder } from './prepared-visibility-oracle.mjs';

const output = process.argv[2];
if (!output) throw new TypeError('Usage: node tools/audit-prepared-depth.mjs <report.json>');
const rows = [];
for (const { id } of OBJECTS) {
  let definition;
  try { definition = JSON.parse(await readFile(`src/planets/${id}/prepared/runtime.json`, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (!definition?.surfaceHit) { rows.push({ id, reason: 'no triangle surface contract' }); continue; }
  await preparePresentationBindings(definition, process.cwd(), { onDepthResult({ source, compiled, surface, reason }) {
    const triangles = source.surfaceHit.triangles;
    assert.deepEqual(compiled.surfaceHit.triangles, triangles);
    assert.deepEqual(compiled.assets, source.assets);
    assert.deepEqual(restoreDepthSource(compiled), source, 'Restoration must recover the entire original definition, not just geometry');
    const row = { id, faces: triangles.length, reason, compiled: Boolean(compiled.depthPartitions), addedNodes: compiled.tree.nodes.length - source.tree.nodes.length };
    if (surface) {
      const plan = partitionSurface(triangles, 64, surface.frontSigns);
      row.groups = plan.groups.map(group => group.length);
      const radius = Math.max(...triangles.flat().map(point => Math.hypot(...point)));
      const directions = Array.from({ length: 24 }, (_, i) => {
        const z = 1 - 2 * (i + 0.5) / 24, angle = i * Math.PI * (3 - Math.sqrt(5));
        return [Math.sqrt(1-z*z)*Math.cos(angle), Math.sqrt(1-z*z)*Math.sin(angle), z];
      });
      const eyes = directions.flatMap(direction => [1.3, 5].map(distance => direction.map(v => v * radius * distance)));
      // Actual face centres aim rays into the surface, including concavities.
      const targets = triangles.filter((_, i) => i % 7 === 0).map(face => [0,1,2].map(axis => face.reduce((sum, v) => sum + v[axis], 0) / 3));
      row.oracle = verifyRayOrder(triangles, surface.frontSigns, plan, eyes, targets);
    }
    rows.push(row); console.log(JSON.stringify(row));
  } });
}
await writeFile(output, JSON.stringify(rows, null, 2) + '\n');
