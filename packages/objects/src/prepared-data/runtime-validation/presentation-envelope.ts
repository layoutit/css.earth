import { checks, failure } from '@cssearth/core';
import type { CameraPlan } from '../camera/runtime-camera-types.js';
import type { ObjectControls } from '../runtime/object-controls.js';
import { OBJECT_RUNTIME_SCHEMA } from '../runtime/object-controls.js';
import { PREPARED_PRESENTATION_SCHEMA } from '../presentation/prepared-presentation-schema.js';
import { validatePreparedCubicSky, validateDirectionalSunPlan } from '../sky/sky-contract.js';
import { requireCamera } from './camera.js';
import { requireControls } from './controls.js';
import { requireObjectControls } from '../surface/shell-controls.js';
import { record, fail, text, choice } from './guards.js';

const fields = ['schema', 'camera', 'sky', 'sun', 'assets', 'tree', 'variants', 'materials', 'viewBindings', 'animations',
  'motion', 'depthPartitions', 'resourceOrder', 'destinations', 'motionFrame', 'surfaceHit', 'textureLevels', 'features'];
const authoredFail = failure('Prepared presentation: ');
const authored = checks(authoredFail);

// Prepared JSON objects/arrays coerce to strings in the historical relational comparison.
// Keep that primitive, because two strings compare lexically even when both contain numbers.
const comparisonValue = (value: unknown): string | number =>
  typeof value === 'string' || (value !== null && typeof value === 'object') ? String(value) : Number(value);
const zoomOrdered = (maximum: unknown, minimum: unknown): boolean =>
  comparisonValue(maximum) >= comparisonValue(minimum);

/** One structural envelope admission. Authored plans retain minimal cameras and historical diagnostics;
 * runtime plans require identity, controls and the complete camera before transport. JSON admission is the caller's
 * earlier boundary, so each policy retains its historical traversal and control-validation order. */
export function requirePresentationEnvelope(value: unknown, policy: 'runtime'): Record<string, unknown> & { camera: CameraPlan; controls: ObjectControls };
export function requirePresentationEnvelope(value: unknown, policy: 'authored', controls: unknown): Record<string, unknown>;
export function requirePresentationEnvelope(value: unknown, policy: 'authored' | 'runtime', controls?: unknown): Record<string, unknown> {
  const plan = policy === 'authored' ? authored.record(value, 'plan', fields)
    : record(value, 'runtime plan', [...fields, 'id', 'controls', 'deferredDatasets']);
  if (policy === 'authored') {
    if (plan.resourceOrder !== undefined && plan.resourceOrder !== 'content-first' && plan.resourceOrder !== 'materials-first')
      authoredFail(`unsupported resource order: ${String(plan.resourceOrder)}`);
    if (plan.schema !== PREPARED_PRESENTATION_SCHEMA) authoredFail('schema is incompatible');
    requireObjectControls(controls);
    validatePreparedCubicSky(plan.sky, 'authored');
    if (plan.sun !== null) validateDirectionalSunPlan(plan.sun);
    // Authored camera admission historically accepts additional fields and a minimal three-number plan.
    const camera = plan.camera;
    const field = (name: string): unknown => camera !== null && typeof camera === 'object' ? Reflect.get(camera, name) : undefined;
    if (!(Number(field('sceneScale')) > 0) || !(Number(field('minimumZoom')) > 0) ||
        !zoomOrdered(field('maximumZoom'), field('minimumZoom'))) authoredFail('camera plan is incomplete');
  } else {
    if (plan.schema !== OBJECT_RUNTIME_SCHEMA) fail('runtime schema is incompatible');
    const id = text(plan.id, 'object id'); if (!/^[a-z][a-z0-9-]*$/.test(id)) fail('object identity is invalid');
    requireControls(plan.controls); requireCamera(plan.camera); validatePreparedCubicSky(plan.sky, 'runtime');
    if (plan.sun !== undefined && plan.sun !== null) validateDirectionalSunPlan(plan.sun, 'runtime');
    if (plan.resourceOrder !== undefined) choice(plan.resourceOrder, ['content-first', 'materials-first'], 'resource order');
  }
  return plan;
}
