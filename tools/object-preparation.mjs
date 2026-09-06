import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAuthoredObjectDescriptor, parseObjectDescriptor } from '@cssearth/objects';
import { runPreparationSteps } from '../src/platform/preparation-runner.mjs';

const defaultProjectRoot = resolve(import.meta.dirname, '..');
const localSteps = Object.freeze({
  'verify-sources': ['verify-source-manifest.mjs', '--probe'],
  title: ['prepare-title.mjs'],
  'panel-content': ['prepare-panel-content.mjs'],
  assets: ['prepare-assets.mjs'],
  starfield: ['prepare-starfield.mjs'],
  'sky-sun': ['prepare-sky-sun.mjs'],
  lenses: ['prepare-lenses.mjs'],
  charts: ['prepare-charts.mjs'],
  'system-markers': ['prepare-system-markers.mjs'],
  'surface-gallery': ['prepare-surface-gallery.mjs'],
  scene: ['prepare-scene.mjs'],
  presentation: ['prepare-presentation.mjs'],
  'runtime-assets': ['prepare-runtime-asset-manifest.mjs'],
});

/** JSON selects known capabilities; it cannot supply commands or arguments. */
export function resolveObjectPreparation(input, { projectRoot = defaultProjectRoot } = {}) {
  const descriptor = parseObjectDescriptor(input), recipe = descriptor.properties.preparation;
  if (descriptor.properties.recipe) {
    parseAuthoredObjectDescriptor(descriptor);
    if (descriptor.type !== 'layered-body') throw new TypeError('Unsupported prepared object type.');
    return Object.freeze({ objectName: typeof recipe?.label === 'string' ? recipe.label : descriptor.id,
      projectRoot: resolve(projectRoot), toolDirectory: resolve(projectRoot, 'src/planets', descriptor.id, 'tools'),
      steps: Object.freeze([Object.freeze(['../../../../tools/objects/dist/prepare-authored.js', descriptor.id, '--write'])]) });
  }
  if (descriptor.type !== 'layered-body' || !recipe || typeof recipe !== 'object' || Array.isArray(recipe) ||
      recipe.schema !== 'cssearth-object-preparation@1' ||
      Object.keys(recipe).some(key => !['schema', 'label', 'steps'].includes(key)) ||
      typeof recipe.label !== 'string' || !recipe.label.trim() ||
      !Array.isArray(recipe.steps) || !recipe.steps.length || new Set(recipe.steps).size !== recipe.steps.length) {
    throw new TypeError('Object preparation requires a supported type and versioned capability recipe.');
  }
  const steps = recipe.steps.map(capability => {
    if (typeof capability !== 'string') throw new TypeError('Preparation capabilities must be names.');
    if (capability === 'controls') return Object.freeze(['../../../../tools/prepare-object-controls.mjs', `--object=${descriptor.id}`]);
    if (!Object.hasOwn(localSteps, capability)) throw new TypeError(`Unknown preparation capability: ${capability}.`);
    return Object.freeze([...localSteps[capability]]);
  });
  const root = resolve(projectRoot);
  return Object.freeze({ objectName: recipe.label, projectRoot: root,
    toolDirectory: resolve(root, 'src/planets', descriptor.id, 'tools'), steps: Object.freeze(steps) });
}

export async function readObjectPreparation(descriptorPath, { projectRoot = defaultProjectRoot } = {}) {
  const path = descriptorPath instanceof URL ? fileURLToPath(descriptorPath) : resolve(descriptorPath);
  const input = await readFile(path, 'utf8'), plan = resolveObjectPreparation(input, { projectRoot });
  if (path !== resolve(plan.toolDirectory, '../object.json')) {
    throw new TypeError('Preparation descriptor does not match its object directory.');
  }
  return plan;
}

export async function runObjectPreparation(descriptorPath, { projectRoot = defaultProjectRoot, runCommand } = {}) {
  const plan = await readObjectPreparation(descriptorPath, { projectRoot });
  await runPreparationSteps({ ...plan, ...(runCommand ? { runCommand } : {}) });
}
