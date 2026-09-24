import assert from 'node:assert/strict';
import { mkdir, readFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createStarRemover } from '../../services/star-removal.ts';
import { createReconstructor } from '../../services/density-reconstruction.ts';
import { promoteVolumeLenses, type VolumeLensPromotion } from './volume-lens-promotion.ts';
import { parseBakeArgs, readRecipe } from './config.ts';
import { bakeDensity, bakePreviews, bakeSeparationPreviews } from './assets.ts';
import { prepareBaseline, prepareEnvironment } from './removal.ts';
import { hash, json, localPath, pinned } from './io.ts';
import { writeAtomic } from '@cssearth/volume-bake/compact-inputs/io';
import { deliveryReady, restoreDelivery } from './delivery.ts';
import { prepareConfiguredDensityPlacements } from './configured-placement.ts';
import { bakeReferenceTarget } from './reference-target.ts';

export async function bakeNebula(root: string, args: string[]) {
  const options = parseBakeArgs(args), recipePath = localPath(root, options.recipe);
  const recipe = await readRecipe(root, recipePath);
  if (options.ifMissing) {
    assert.ok(recipe.delivery, 'This recipe has no application delivery.');
    if (await deliveryReady(root, recipe.delivery)) {
      console.log(`DELIVERY_CACHED ${recipe.delivery.directory}: every app asset verified`);
      return;
    }
  }
  // A full processing run is research. The application delivery replays from its object's own compact inputs
  // (`pnpm prepare:nebulae`), never from this command.
  if (!options.research && options.stage === 'all')
    throw new Error('A full bake reruns the research pipeline; pass --research. Application deliveries are restored by pnpm prepare:nebulae.');
  const selected = recipe.images.filter(image => !options.image || image.imageId === options.image);
  assert.ok(selected.length, `Unknown image: ${options.image}`);
  const catalogue = JSON.parse((await pinned(root, recipe.catalogue)).toString());
  for (const image of selected) assert.equal(catalogue.targets.flatMap((target: any) => target.images).filter((input: any) => input.id === image.imageId).length, 1);
  const promotion = JSON.parse((await pinned(root, recipe.promotion)).toString()) as VolumeLensPromotion;
  const subject = (await json(resolve(root, 'labs/nebula/packages/lab/src/state/subjects.json'))).find((value: any) => value.id === recipe.subjectId);
  assert.equal(subject?.stars, recipe.stars.path);
  assert.deepEqual(subject.density.starAlignmentReference, recipe.starAlignment);
  assert.ok(recipe.densityObjects.includes(subject.density.directory));
  // One command at a time; never clear another process's pending output or alter the live server.
  const directory = resolve(root, '.local/nebula-lab/bakes');
  await mkdir(directory, { recursive: true });
  const lock = resolve(directory, `${recipe.id}.lock`);
  try { await mkdir(lock); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'EEXIST') throw new Error(`Bake already running, or interrupted lock remains: ${lock}`); throw error; }
  await writeAtomic(resolve(lock, 'owner.json'), JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
  const controller = new AbortController(), cancel = () => controller.abort();
  process.once('SIGINT', cancel); process.once('SIGTERM', cancel);
  let last = 0, lastStage = '';
  const progress = (event: {stage: string; current: number; total: number; message: string}) => {
    if (event.stage !== lastStage || Date.now() - last > 5000 || event.current === event.total) {
      console.log(`${event.stage.toUpperCase()} ${event.current}/${event.total}: ${event.message}`);
      last = Date.now(); lastStage = event.stage;
    }
  };
  const results: {imageId: string; removalResultId: string; resultId?: string}[] = [];
  try {
    console.log(`BAKE ${recipe.id}: ${selected.map(image => image.imageId).join(', ')}; through ${options.stage}`);
    for (const object of recipe.densityObjects) { controller.signal.throwIfAborted(); await bakeDensity(root, object); }
    await prepareConfiguredDensityPlacements(root);
    controller.signal.throwIfAborted();
    if (options.stage !== 'density') {
      await bakePreviews(root, catalogue, selected.map(image => image.imageId));
      if (recipe.starCalibration) await bakeReferenceTarget(root, recipe.starCalibration.path);
    }
    if (!['density', 'assets'].includes(options.stage)) {
      const python = await prepareEnvironment(root, recipe, options.python);
      const remove = createStarRemover(root, { pythonPath: python });
      const reconstruct = createReconstructor(root);
      for (const image of selected) {
        controller.signal.throwIfAborted(); await prepareBaseline(root, recipe, image, python);
        await bakeSeparationPreviews(root, recipe.separationPlan.path, image.imageId);
        const removal: any = await remove({ imageId: image.imageId, action: 'apply' }, controller.signal, progress);
        assert.ok(removal.applied?.resultId, 'Removal did not produce a native applied result.');
        const row = { imageId: image.imageId, removalResultId: removal.applied.resultId, resultId: undefined as string | undefined };
        if (options.stage !== 'removal') {
          const result = await reconstruct({ action: 'apply', subjectId: recipe.subjectId, imageId: image.imageId,
            removalResultId: row.removalResultId, placement: image.placement, appearance: image.appearance }, controller.signal, progress);
          row.resultId = result.resultId;
        }
        results.push(row);
      }
    }
    let output: string | undefined;
    controller.signal.throwIfAborted();
    if (options.stage === 'all') {
      const lenses = selected.map(image => {
        const lens = promotion.lenses.find(value => value.imageId === image.imageId);
        assert.ok(lens, `Missing saved presentation: ${image.imageId}`);
        return { ...lens, resultId: results.find(value => value.imageId === image.imageId)!.resultId! };
      });
      const replay = { ...promotion, defaultLens: lenses.some(lens => lens.imageId === promotion.defaultLens) ? promotion.defaultLens : lenses[0]!.imageId, lenses };
      const key = hash(JSON.stringify([hash(await readFile(recipePath)), results]));
      output = `.local/nebula-lab/bakes/${recipe.id}-${key}`;
      const pending = resolve(root, output + '.pending');
      await rm(pending, { recursive: true, force: true });
      try {
        await promoteVolumeLenses(root, replay, pending);
        const manifest = await json(resolve(pending, 'source/lens-manifest.json'));
        for (const path of Object.keys(manifest.outputs)) await pinned(pending, { path });
        // Identical results can be replayed without overwriting an earlier completed bank.
        try { await rename(pending, resolve(root, output)); }
        catch (error) {
          if (!['ENOTEMPTY', 'EEXIST'].includes((error as NodeJS.ErrnoException).code!)) throw error;
          for (const path of Object.keys(manifest.outputs)) await pinned(resolve(root, output), { path });
        }
      } finally { await rm(pending, { recursive: true, force: true }); }
      if (recipe.delivery) await restoreDelivery(root, recipe.delivery, results);
    }
    controller.signal.throwIfAborted();
    const receipt = { schema: 'cssearth-nebula-bake-receipt@1', recipe: { path: options.recipe, sha256: hash(await readFile(recipePath)) },
      stage: options.stage, images: results, output, completedAt: new Date().toISOString() };
    await writeAtomic(resolve(directory, `${recipe.id}-${options.stage}${options.image ? '-' + options.image : ''}.json`), JSON.stringify(receipt, null, 2) + '\n');
    console.log(`BAKE_COMPLETE ${recipe.id}${output ? ': ' + output : ': ' + options.stage}`);
    return receipt;
  } finally { process.removeListener('SIGINT', cancel); process.removeListener('SIGTERM', cancel); await rm(lock, { recursive: true, force: true }); }
}
