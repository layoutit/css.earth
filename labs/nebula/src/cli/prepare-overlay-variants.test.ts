import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareOverlayVariants } from './prepare-overlay-variants.js';
import { overlayVariantsPath } from '../viewer/overlay-variants.js';

test('delivery rejects failed proof, changed registration and changed prepared geometry before writing variants', async () => {
  const directory = await mkdtemp('.local/nebula-lab/variant-proof-test-');
  const before = await readFile(overlayVariantsPath);
  const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
  const plan = JSON.parse(await readFile('labs/nebula/models/lmc/star-separation/plan.json', 'utf8'));
  const catalogue = JSON.parse(await readFile(plan.catalogue, 'utf8'));
  const writeJson = async (path: string, value: unknown) => { const bytes = Buffer.from(JSON.stringify(value)); await writeFile(path, bytes); return hash(bytes); };
  const planPath = join(directory, 'plan.json'), cataloguePath = join(directory, 'catalogue.json');
  try {
    const report = JSON.parse(await readFile(plan.alignmentReport.path, 'utf8'));
    const failedPath = join(directory, 'failed-proof.json');
    const failedHash = await writeJson(failedPath, { ...report, pass: false, status: 'failed' });
    await writeJson(planPath, { ...plan, alignmentReport: { path: failedPath, sha256: failedHash } });
    await assert.rejects(prepareOverlayVariants(planPath, ['wise-wide-infrared']), /report did not pass/);

    const changed = structuredClone(catalogue), source = changed.targets[0].images.find((item: { id: string }) => item.id === 'wise-wide-infrared');
    source.wcs.rotationDeg += 1;
    await writeJson(cataloguePath, changed); await writeJson(planPath, { ...plan, catalogue: cataloguePath });
    await assert.rejects(prepareOverlayVariants(planPath, ['wise-wide-infrared']), /registration differs/);

    const changedManifest = structuredClone(catalogue), target = changedManifest.targets[0];
    const manifest = JSON.parse(await readFile(`${target.directory}/overlays.json`, 'utf8'));
    manifest.overlays.find((item: { id: string }) => item.id === 'wise-wide-infrared').style.transform = 'matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1)';
    target.directory = join(directory, 'changed-prepared'); await mkdir(target.directory);
    await writeJson(`${target.directory}/overlays.json`, manifest); await writeJson(cataloguePath, changedManifest);
    await assert.rejects(prepareOverlayVariants(planPath, ['wise-wide-infrared']), /Prepared image geometry differs/);
    assert.deepEqual(await readFile(overlayVariantsPath), before);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
