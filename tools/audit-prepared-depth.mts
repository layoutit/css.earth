import {requireObjectRuntimeDefinition} from './object-runtime-contract.mts';
import type {CheckedObjectRuntimeDefinition} from './object-runtime-contract.mts';
import {requireRecord,hasErrorCode} from './source-values.mts';
interface AuditRow {id:string;reason?:string|null;faces?:number;compiled?:boolean;addedNodes?:number;groups?:number[];oracle?:ReturnType<typeof verifyRayOrder>;}
// Inspect the registry's real source/rendered contracts without writing banks.
// Pair this mathematical oracle with native browser screenshots and traces.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { OBJECTS } from '../site/objects.mts';
import { preparePresentationBindings } from './prepared-presentation-bindings.mts';
import { partitionSurface, restoreDepthSource } from './prepared-depth-partitions.mts';
import { verifyRayOrder } from './prepared-visibility-oracle.mts';

const output = process.argv[2];
if (!output) throw new TypeError('Usage: node tools/audit-prepared-depth.mts <report.json>');
const rows:AuditRow[] = [];
for (const { id } of OBJECTS) {
  let definition:CheckedObjectRuntimeDefinition|undefined;
  try { definition = requireObjectRuntimeDefinition(JSON.parse(await readFile(`src/objects/${id}/prepared/runtime.json`, 'utf8'))); }
  catch (error) { if (!hasErrorCode(error,'ENOENT')) throw error; }
  if (!definition?.surfaceHit) { rows.push({ id, reason: 'no triangle surface contract' }); continue; }
  await preparePresentationBindings(definition, process.cwd(), { onDepthResult({ source, compiled, surface, reason }) {
    assert.ok(source.surfaceHit && compiled.surfaceHit,"Depth compilation must preserve its surface contract");
    const triangles = source.surfaceHit.triangles;
    assert.deepEqual(compiled.surfaceHit.triangles, triangles);
    assert.deepEqual(requireRecord(compiled).assets, requireRecord(source).assets);
    assert.deepEqual(restoreDepthSource(compiled), source, 'Restoration must recover the entire original definition, not just geometry');
    const row:AuditRow = { id, faces: triangles.length, reason, compiled: Boolean(compiled.depthPartitions), addedNodes: compiled.tree.nodes.length - source.tree.nodes.length };
    if (surface) {
      assert.ok(surface.frontSigns,"Depth ray oracle requires measured source face orientations");
      const plan = partitionSurface(triangles, 64, surface.frontSigns);
      row.groups = plan.groups.map(group => group.length);
      const radius = Math.max(...triangles.flat().map(point => Math.hypot(...point)));
      const directions = Array.from({ length: 24 }, (_, i) => {
        const z = 1 - 2 * (i + 0.5) / 24, angle = i * Math.PI * (3 - Math.sqrt(5));
        return [Math.sqrt(1-z*z)*Math.cos(angle), Math.sqrt(1-z*z)*Math.sin(angle), z] as const;
      });
      const eyes = directions.flatMap(direction => [1.3, 5].map(distance => [direction[0]*radius*distance,direction[1]*radius*distance,direction[2]*radius*distance] as const));
      // Actual face centres aim rays into the surface, including concavities.
      const targets = triangles.filter((_, i) => i % 7 === 0).map(face => {const center=(axis:number)=>face.reduce((sum,v)=>sum+v[axis],0)/3;return [center(0),center(1),center(2)] as const;});
      row.oracle = verifyRayOrder(triangles, surface.frontSigns, plan, eyes, targets);
    }
    rows.push(row); console.log(JSON.stringify(row));
  } });
}
await writeFile(output, JSON.stringify(rows, null, 2) + '\n');
