import type { ObjectRuntimeDefinition } from '../runtime/object-runtime-types.js';
import { choice, fail, record, requireJsonData, text } from './guards.js';
import { requireAssets, requireTree } from './resources-tree.js';
import { requireCamera, requireControls } from './camera-controls.js';
import { requireSky, requireSun } from './sky.js';
import { requireHeliocentric } from './heliocentric.js';
import { requireMaterials } from './materials.js';
import { requireAnimations, requireOptionalPresentation, requireVariants, requireViewBindings } from './presentation.js';

/** Validate external prepared JSON before any DOM, image, or animation is created. */
export function parsePreparedObjectRuntime(value: unknown): ObjectRuntimeDefinition {
  requireDefinition(value);
  return value;
}
function requireDefinition(value: unknown): asserts value is ObjectRuntimeDefinition {
  requireJsonData(value);
  const plan = record(value, 'runtime plan', ['schema', 'id', 'controls', 'camera', 'sky', 'sun', 'assets', 'tree', 'variants', 'materials',
    'viewBindings', 'animations', 'resourceOrder', 'destinations', 'motionFrame', 'pageLayers', 'heliocentricView']);
  if (plan.schema !== 'cssearth-object-runtime@4') fail('runtime schema is incompatible');
  const id = text(plan.id, 'object id'); if (!/^[a-z][a-z0-9-]*$/.test(id)) fail('object identity is invalid');
  requireControls(plan.controls); requireCamera(plan.camera); requireSky(plan.sky);
  if (plan.sun !== undefined && plan.sun !== null) requireSun(plan.sun);
  if (plan.heliocentricView !== undefined && plan.heliocentricView !== null) requireHeliocentric(plan.heliocentricView, plan.camera, plan.sun != null, id);
  if (plan.resourceOrder !== undefined) choice(plan.resourceOrder, ['content-first', 'materials-first'], 'resource order');
  requireAssets(plan.assets); requireTree(plan.tree);
  const resources = new Set(plan.assets.entries.map(entry => entry.key));
  requireMaterials(plan.materials, plan.tree, resources);
  requireVariants(plan.variants, plan.tree, resources, plan.materials, plan.controls, plan.camera);
  requireViewBindings(plan.viewBindings, plan.tree, plan.camera); requireAnimations(plan.animations, plan.tree);
  requireOptionalPresentation(plan, plan.tree, plan.controls);
}
