import type { ObjectRuntimeDefinition } from '../runtime/object-runtime-types.js';
import { fail, parsedJsonNumbersFinite, requireJsonData } from './guards.js';
import { requireAssets, requireTree } from './resources-tree.js';
import { requirePresentationEnvelope } from './presentation-envelope.js';
import { requireMaterials } from './materials.js';
import { requireAnimations, requireOptionalPresentation, requireVariants, requireViewBindings } from './presentation.js';
import { requireTextureLevels } from './prepared-texture-levels.js';
import { requireDepthPartitions } from './depth-partitions.js';
import { requireDeferredDatasets } from '../content/dataset-tables.js';

/** Validate external prepared JSON before any DOM, image, or animation is created.
 * `parsedJson` marks a direct JSON.parse result: only its numbers need the
 * plain-data check, and the labelled walk runs only to report a failure. */
export function parsePreparedObjectRuntime(value: unknown, { parsedJson = false }: { parsedJson?: boolean } = {}): ObjectRuntimeDefinition {
  requireDefinition(value, parsedJson);
  return value;
}
function requireDefinition(value: unknown, parsedJson: boolean): asserts value is ObjectRuntimeDefinition {
  if (!parsedJson || !parsedJsonNumbersFinite(value)) requireJsonData(value);
  const plan = requirePresentationEnvelope(value, 'runtime');
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
