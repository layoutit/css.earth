import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prepareOverlayVariants } from './prepare-overlay-variants.ts';
import { overlayVariantsPath } from '../../features/legacy-viewer/overlay-variants.ts';

test('delivery rejects failed proof, changed registration and changed prepared geometry before writing variants', async () => {
  const directory = await mkdtemp('.local/nebula-lab/variant-proof-test-');
  const before = await readFile(overlayVariantsPath);
  const plan = JSON.parse(await readFile('src/objects/lmc-volume/source/star-separation/plan.json', 'utf8'));
  const catalogue = JSON.parse(await readFile(plan.catalogue, 'utf8'));
  const writeJson = async (path: string, value: unknown) => { await writeFile(path, JSON.stringify(value)); };
  const planPath = join(directory, 'plan.json'), cataloguePath = join(directory, 'catalogue.json');
  try {
    const report = JSON.parse(await readFile(plan.alignmentReport.path, 'utf8'));
    const failedPath = join(directory, 'failed-proof.json');
    await writeJson(failedPath, { ...report, pass: false, status: 'failed' });
    await writeJson(planPath, { ...plan, alignmentReport: { path: failedPath } });
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
