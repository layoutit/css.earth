/** Real API, registered inputs and completed prepared PolyCSS outputs. No mocked processing. */
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { readStructureCatalogue } from '../src/features/observations/models/structures-model.js';
import { readGeometryMap } from '../src/features/observations/models/geometry-model.js';
import { initializeShapeCloud } from '../src/features/shape-cloud/model.ts';
import { readShapeCloudResult } from '../src/features/shape-cloud/result.ts';
import type { ShapeCloudRequest, ShapeCloudResult } from '../src/features/shape-cloud/types.ts';
import { validateShapeCloudResult } from '../src/server/routes/shape-cloud.ts';

const endpoint = 'http://127.0.0.1:4331/__nebula/shape-cloud-jobs';
const cataloguePath = '.local/nebula-lab/observations/helix/structures/catalogue.json';
const catalogue = readStructureCatalogue(JSON.parse(await readFile(cataloguePath, 'utf8')));
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
async function send(path: string, body?: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${endpoint}${path}`, body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const value: unknown = await response.json();
  assert.ok(response.ok, JSON.stringify(value)); assert.ok(record(value) && record(value.job)); return value.job;
}
async function apply(request: ShapeCloudRequest): Promise<{ jobId: string; result: ShapeCloudResult }> {
  const jobId = randomUUID(); let job = await send('', { requestId: jobId, request });
  const deadline = Date.now() + 120_000;
  while (job.status === 'queued' || job.status === 'running') {
    if (Date.now() > deadline) throw new Error('Shape cloud API did not finish in two minutes.');
    await new Promise(resolve => setTimeout(resolve, 200)); job = await send(`/${jobId}`);
  }
  assert.equal(job.status, 'completed', JSON.stringify(job));
  const result = readShapeCloudResult(job.result); await validateShapeCloudResult(process.cwd(), result);
  assert.deepEqual(result.settings, request.settings);
  assert.equal(result.quality, request.quality ?? 'detailed');
  return { jobId, result };
}
const results = [], originals: { path: string; sha256: string }[] = [];
for (const image of catalogue.images) {
  assert.ok(image.geometry);
  const geometry = readGeometryMap(JSON.parse(await readFile(`${image.directory}/${image.geometry.file}`, 'utf8')), image);
  const settings = initializeShapeCloud(geometry);
  const request: ShapeCloudRequest = { action: 'apply', imageId: image.id, cataloguePath, geometrySha256: image.geometry.sha256,
    width: image.width, height: image.height, settings };
  for (const file of ['map.json', 'source.png']) {
    const path = `${image.directory}/${file}`;
    originals.push({ path, sha256: createHash('sha256').update(await readFile(path)).digest('hex') });
  }
  const started = performance.now(), completed = await apply(request);
  assert.equal(completed.result.empty, false);
  assert.equal(completed.result.geometrySha256, image.geometry.sha256);
  results.push({ imageId: image.id, request, ...completed });
  console.log(`SHAPE_CLOUD_API_READY ${image.id} components=${settings.components.length} seconds=${((performance.now() - started) / 1000).toFixed(2)} ${completed.result.neutral?.path}`);
}
for (const original of originals) assert.equal(createHash('sha256').update(await readFile(original.path)).digest('hex'), original.sha256);
const first = results[0]!;
const repeated = await apply(first.request); assert.equal(repeated.result.id, first.result.id, 'Same recipe must restore its exact prepared result.');
const draftStarted = performance.now(), draft = await apply({ ...first.request, quality: 'draft' });
assert.notEqual(draft.result.id, first.result.id, 'Draft must never reuse a detailed cache identity.');
assert.deepEqual(draft.result.settings, first.result.settings);
assert.equal(draft.result.unitsPerPixel, first.result.unitsPerPixel);
console.log(`SHAPE_CLOUD_DRAFT_READY seconds=${((performance.now() - draftStarted) / 1000).toFixed(2)}`);
const output = '.local/nebula-lab/observations/helix/structures/browser'; await mkdir(output, { recursive: true });
await writeFile(`${output}/shape-cloud-api.json`, JSON.stringify({ passed: true, results, draft, sourcePixelsUnchanged: true, repeatedId: repeated.result.id }, null, 2));
console.log('SHAPE_CLOUD_API_PASS');
