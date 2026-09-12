import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { parsePreparedObservationEvidence } from '../../src/platform/observation-evidence.mts';
import { verifyObservationEvidenceGenerator } from './provenance.mts';

const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');

test('prepared observation evidence verifies the actual contained generator bytes', async t => {
  const root = await mkdtemp(resolve(tmpdir(), 'cssearth-observation-generator-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = resolve(root, 'tools/objects/observation/generator.mts'), bytes = Buffer.from('export const generator = 1;\n');
  await mkdir(resolve(path, '..'), { recursive: true });
  await writeFile(path, bytes);
  await writeFile(resolve(root, 'tools/objects/observation/decoder.mts'), 'export const decoder = 1;\n');
  const report = parsePreparedObservationEvidence({ schema: 'cssearth-prepared-observation-evidence@1', objectId: 'fixture', sourceManifestSha256: hash('manifest'),
    generator: { path: 'tools/objects/observation/generator.mts', sha256: hash(bytes), dependencies: [{ path: 'tools/objects/observation/decoder.mts', sha256: hash('export const decoder = 1;\n') }] }, inputs: [{ id: 'observation', sha256: hash('source') }],
    datasets: [{ lensId: 'surface', recipe: { id: 'fixture', sha256: hash('recipe') }, observations: [{ id: 'frame', title: 'Frame', sourceImageIds: ['observation'], cameraSourceIds: ['observation'], shapeSourceIds: ['observation'],
      registration: { kind: 'archived-controls', method: 'fixture', sourceId: 'observation', validatedControlCount: 1, maximumResidualPixels: 0 } }] }] });
  await verifyObservationEvidenceGenerator(report, root);
  await writeFile(resolve(root, 'tools/objects/observation/decoder.mts'), 'export const decoder = 2;\n');
  await assert.rejects(verifyObservationEvidenceGenerator(report, root), /generator differs from its pinned bytes/u);
  await writeFile(resolve(root, 'tools/objects/observation/decoder.mts'), 'export const decoder = 1;\n');
  await writeFile(path, 'export const generator = 2;\n');
  await assert.rejects(verifyObservationEvidenceGenerator(report, root), /generator differs from its pinned bytes/u);
});
