import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { sha256 } from '@cssearth/core/node';
import { refreshObjectCharts } from './refresh-charts.mts';

test('partial refresh changes only chart bytes and sizes; refuses local content edits', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'chart-refresh-test-'));
  const object = resolve(root, 'src/objects/fixture');
  try {
    await mkdir(resolve(object, 'source/content'), { recursive: true });
    await mkdir(resolve(object, 'prepared'), { recursive: true });
    await mkdir(resolve(root, 'public/scenes/fixture'), { recursive: true });
    const content = { schema: 'cssearth-prepared-content@1', objectId: 'fixture', facts: ['keep facts'],
      galleries: ['keep gallery'], charts: [{ src: '/scenes/fixture/phase.svg', width: 1, height: 1, alt: 'keep alt' }] };
    const bytes = Buffer.from(JSON.stringify(content));
    await writeFile(resolve(object, 'prepared/content.json'), bytes);
    const untouched = { location: 'public', filename: 'surface.webp', bytes: 17, sha256: 'a'.repeat(64) };
    const inventory = { schema: 'cssearth-inventory@1', assets: [untouched,
      { location: 'public', filename: 'phase.svg', bytes: 1, sha256: 'b'.repeat(64) },
      { location: 'prepared', filename: 'content.json', bytes: bytes.length, sha256: sha256(bytes) }] };
    await writeFile(resolve(object, 'inventory.json'), JSON.stringify(inventory));
    await writeFile(resolve(object, 'source/content/charts.json'), JSON.stringify({ schema: 'cssearth-chart-assets@1',
      publicBase: '/scenes/fixture/', charts: [{ kind: 'phase', id: 'fixture-phase', title: 'Phase', description: 'Phase model',
        output: 'phase.svg', metadata: {}, sampleCount: 3, maximumAngleDegrees: 90,
        segments: [{ kind: 'polynomialMagnitude', maximumAngleDegrees: 90, coefficients: [0, .01] }] }] }));
    const dimensions = await refreshObjectCharts(root, 'fixture', true);
    assert.deepEqual(dimensions, [{ src: '/scenes/fixture/phase.svg', width: 306, height: 275 }]);
    const next = JSON.parse(await readFile(resolve(object, 'prepared/content.json'), 'utf8'));
    assert.deepEqual(next, { ...content, charts: [{ ...content.charts[0], ...dimensions[0] }] });
    const updated = await readFile(resolve(object, 'inventory.json'), 'utf8');
    assert.deepEqual(JSON.parse(updated).assets.find((a: { filename: string }) => a.filename === 'surface.webp'), untouched);
    await refreshObjectCharts(root, 'fixture', true);
    assert.equal(await readFile(resolve(object, 'inventory.json'), 'utf8'), updated);
    await writeFile(resolve(object, 'prepared/content.json'), `${JSON.stringify(next)}\n `);
    await assert.rejects(refreshObjectCharts(root, 'fixture', true), /differs from inventory/);
    assert.equal(await readFile(resolve(object, 'inventory.json'), 'utf8'), updated);
  } finally { await rm(root, { recursive: true, force: true }); }
});
