import { projectRoot as checkoutProjectRoot } from '@cssearth/core/node';
// `@cssearth/bake/prepare-objects` (Node only): the catalogue-wide preparation run. It runs the shared steps, each
// object's preparation through `run-implemented-objects`'s concurrency-scheduled queue, and navigation, then inventories
// every prepared body. `packages/bake/cli/prepare-objects.mts` is its command.
import assert from "node:assert/strict";
import { access } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { inventoryPreparedAssets, readPreparedObjects } from '@cssearth/objects/node';
import { availableMemoryBytes, defaultPreparationConcurrency, preparationPeakBytes, runObjectCommand, runPreparationObjects } from "../run-implemented-objects/index.ts";

/** The real checkout, found by the shared workspace-marker resolver from source and `dist/`. */
const ROOT = checkoutProjectRoot(import.meta.url);

const sharedSteps = ["site/build/prepare/shell/prepare-shell-titles.mts", "packages/bake/cli/prepare-scientific-charts.mts"];

async function runStep(root: string, argumentsList: readonly string[], label: string) {
  const result = await runObjectCommand({ command: process.execPath, argumentsList, cwd: root });
  assert.equal(result.exitCode, 0, `${label} failed`); assert.equal(result.signal, null, `${label} was stopped by ${result.signal}`);
}

export async function prepareObjects({ projectRoot = checkoutProjectRoot(import.meta.url), objectIds = readPreparedObjects(ROOT).sceneObjects.map(({ id }) => id),
  concurrency = defaultPreparationConcurrency() }: { projectRoot?: string; objectIds?: readonly string[]; concurrency?: number } = {}) {
  const root = resolve(projectRoot);
  for (const script of sharedSteps) await runStep(root, [resolve(root, script)], script);
  const report = await runPreparationObjects({ projectRoot: root, objectIds, concurrency,
    memoryAvailableBytes: availableMemoryBytes, peakMemoryBytes: id => preparationPeakBytes(id, root) });
  await runStep(root, [resolve(root, "packages/bake/cli/prepare-navigation.mts"), ...objectIds], "Navigation preparation");
  // Inventory every prepared body's baked prepared/ files, even when `prepare:object-json` does not run afterward.
  for (const id of objectIds) {
    const objectDirectory = resolve(root, "src/objects", id);
    if (await access(resolve(objectDirectory, "prepared")).then(() => true, () => false)) await inventoryPreparedAssets({ objectId: id, objectDirectory });
  }
  return report;
}
