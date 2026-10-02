import { OBJECT_RUNTIME_SCHEMA } from '../object-controls.js';
import type { ObjectRuntimeDefinition } from '../object-runtime-types.js';
import { choice, fail, parsedJsonNumbersFinite, record, requireJsonData, text } from './guards.js';
import { requireAssets, requireTree } from './resources-tree.js';
import { requireCamera } from './camera.js';
import { requireControls } from './controls.js';
import { validatePreparedCubicSky, validateDirectionalSunPlan } from '../sky-contract.js';
import { requireMaterials } from './materials.js';
import { requireAnimations, requireOptionalPresentation, requireVariants, requireViewBindings } from './presentation.js';
import { requireTextureLevels } from './prepared-texture-levels.js';
import { requireDepthPartitions } from './depth-partitions.js';
import { requireDeferredDatasets } from '../dataset-tables.js';

/** Validate external prepared JSON before any DOM, image, or animation is created.
 * `parsedJson` marks a direct JSON.parse result: only its numbers need the
 * plain-data check, and the labelled walk runs only to report a failure. */
export function parsePreparedObjectRuntime(value: unknown, { parsedJson = false }: { parsedJson?: boolean } = {}): ObjectRuntimeDefinition {
  requireDefinition(value, parsedJson);
  return value;
}
function requireDefinition(value: unknown, parsedJson: boolean): asserts value is ObjectRuntimeDefinition {
  if (!parsedJson || !parsedJsonNumbersFinite(value)) requireJsonData(value);
  const plan = record(value, 'runtime plan', ['schema', 'id', 'controls', 'camera', 'sky', 'sun', 'assets', 'tree', 'variants', 'materials',
    'viewBindings', 'animations', 'motion', 'depthPartitions', 'resourceOrder', 'destinations', 'motionFrame', 'surfaceHit', 'textureLevels', 'features', 'deferredDatasets']);
  if (plan.schema !== OBJECT_RUNTIME_SCHEMA) fail('runtime schema is incompatible');
  const id = text(plan.id, 'object id'); if (!/^[a-z][a-z0-9-]*$/.test(id)) fail('object identity is invalid');
  requireControls(plan.controls); requireCamera(plan.camera); validatePreparedCubicSky(plan.sky, { runtime: true });
  if (plan.sun !== undefined && plan.sun !== null) validateDirectionalSunPlan(plan.sun, { runtime: true });
  if (plan.resourceOrder !== undefined) choice(plan.resourceOrder, ['content-first', 'materials-first'], 'resource order');
  requireAssets(plan.assets); requireTree(plan.tree);
  if (!Array.isArray(plan.tree.activationGroups)) fail('activation groups must be prepared before transport');
  const resources = new Set(plan.assets.entries.map(entry => entry.key));
  requireMaterials(plan.materials, plan.tree, resources);
  const deferred = plan.deferredDatasets;
  requireVariants(plan.variants, plan.tree, resources, plan.materials, plan.controls, plan.camera,
    Array.isArray(deferred) ? deferred.filter(id => typeof id === 'string') : []);
  if (plan.textureLevels !== undefined) requireTextureLevels(plan.textureLevels, plan.variants, resources);
  requireViewBindings(plan.viewBindings, plan.tree, plan.camera); requireAnimations(plan.animations, plan.tree);
  if (plan.motion !== undefined) requireAnimations(plan.motion, plan.tree, true);
  requireDepthPartitions(plan.depthPartitions, plan.tree);
  requireDeferredDatasets(plan.deferredDatasets, { controls: plan.controls, variants: plan.variants });
  requireOptionalPresentation(plan, plan.tree, plan.controls);
}
